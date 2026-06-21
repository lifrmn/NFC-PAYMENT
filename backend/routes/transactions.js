const express = require('express');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { analyzeZScoreAnomaly, HISTORY_SIZE } = require('../utils/fraudDetection');

const router = express.Router();
const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/*                    Z-SCORE BASED ANOMALY DETECTION                         */
/*          Deteksi anomali transaksi berdasarkan 20 histori terakhir         */
/* -------------------------------------------------------------------------- */
/**
 * Fraud Detection menggunakan Z-Score Based Anomaly Detection.
 * Metode: Ambil 20 transaksi historis terakhir sebagai baseline,
 * hitung mean/variance/stddev, lalu Z-Score transaksi baru.
 * Keputusan: Z<=2 ALLOW | 2<Z<=3 REVIEW | Z>3 BLOCK
 *
 * REFERENSI AKADEMIS:
 *   [1] Bolton & Hand (2002). Statistical fraud detection. Statistical Science.
 *       https://doi.org/10.1214/ss/1042727940
 *   [2] Chandola et al. (2009). Anomaly detection: A survey. ACM Comput. Surv.
 *       https://doi.org/10.1145/1541880.1541882
 *   [3] Tagle (2024). ML for Real-time Fraud Detection in NFC Transactions.
 *       https://doi.org/10.62718/vmca.tech-gjtdsi.3.1.sc-1124-009
 *   [4] Vanini et al. (2023). Online payment fraud. Financial Innovation.
 *       https://doi.org/10.1186/s40854-023-00470-w
 *   [5] Zhukabayeva et al. (2025). Anomaly detection via Z-Score.
 */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                          DAPATKAN SEMUA TRANSAKSI                          */
/* -------------------------------------------------------------------------- */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0, userId, status } = req.query;

    const where = {};
    if (userId) {
      const uid = parseInt(String(userId), 10);
      if (!Number.isNaN(uid)) {
        where.OR = [{ senderId: uid }, { receiverId: uid }];
      }
    }
    if (status) where.status = status;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit), 10),
      skip: parseInt(String(offset), 10),
    });

    res.json(transactions);
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
  }
});

/* -------------------------------------------------------------------------- */
/*                   DAPATKAN TRANSAKSI BERDASARKAN ID PENGGUNA               */
/* -------------------------------------------------------------------------- */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID pengguna tidak valid' });
    }

    const { limit = 20, offset = 0, status } = req.query;

    const where = {
      OR: [
        { senderId: userId },
        { receiverId: userId }
      ]
    };
    
    if (status) where.status = status;

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        sender: {
          select: { id: true, name: true, username: true }
        },
        receiver: {
          select: { id: true, name: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit), 10),
      skip: parseInt(String(offset), 10),
    });

    // Tambahkan info tipe transaksi (terkirim/diterima) untuk pengguna yang meminta
    const transactionsWithType = transactions.map(transaction => ({
      ...transaction,
      transactionType: transaction.senderId === userId ? 'sent' : 'received'
    }));

    res.json(transactionsWithType);
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan transaksi pengguna:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi pengguna' });
  }
});

/* -------------------------------------------------------------------------- */
/*           STATISTIK TRANSAKSI (TEMPATKAN SEBELUM /:id)                    */
/* -------------------------------------------------------------------------- */
router.get('/stats/summary', async (req, res) => {
  try {
    const { userId, period = '7d' } = req.query;
    const now = new Date();
    let from;

    if (period === '1d') from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (period === '30d') from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const where = { createdAt: { gte: from } };

    if (userId) {
      const uid = parseInt(String(userId), 10);
      if (!Number.isNaN(uid)) where.OR = [{ senderId: uid }, { receiverId: uid }];
    }

    const [count, sum, avg] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where, _avg: { amount: true } }),
    ]);

    res.json({
      period,
      totalTransactions: count,
      totalAmount: sum._sum.amount || 0,
      averageAmount: avg._avg.amount || 0,
    });
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan statistik transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan statistik transaksi' });
  }
});

/* -------------------------------------------------------------------------- */
/*                          BUAT TRANSAKSI BARU                               */
/* -------------------------------------------------------------------------- */
router.post(
  '/',
  [
    body('amount').isFloat({ min: 0.01 }).withMessage('Jumlah harus lebih dari 0'),
    body('receiverUsername').optional().isString(),
    body('receiverId').optional().isInt(),
    // catatan: senderId dari body tidak dipercaya, hanya fallback
    body('senderId').optional().isInt(),
    body('description').optional().isString(),
    body('deviceId').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        receiverUsername,
        receiverId,
        senderId: senderIdFromBody,
        amount,
        description,
        deviceId,
      } = req.body;

      // Ambil sender dari token (authenticateToken), kalau tidak ada baru fallback body
      const senderId = req.user?.id ?? senderIdFromBody;
      if (!senderId) return res.status(401).json({ error: 'Pengirim tidak terautentikasi' });

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Cari receiver (username lebih diutamakan)
      let receiver = null;
      if (receiverUsername) {
        receiver = await prisma.user.findUnique({ where: { username: receiverUsername } });
      } else if (receiverId) {
        receiver = await prisma.user.findUnique({ where: { id: Number(receiverId) } });
      }
      if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
      if (receiver.id === Number(senderId)) return res.status(400).json({ error: 'Cannot send money to yourself' });

      // Cek saldo sender
      const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } });
      if (!sender || sender.balance < amountNum) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // ======================================================================
      // DETEKSI FRAUD: Z-Score Based Anomaly Detection
      // Ambil 20 transaksi historis terakhir pengguna sebagai baseline
      // Transaksi baru (amountNum) adalah X = transaksi ke-21
      // ======================================================================
      const historicalTxs = await prisma.transaction.findMany({
        where: { senderId: Number(senderId), status: 'completed' },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: HISTORY_SIZE,
      });

      const fraudResult = analyzeZScoreAnomaly(amountNum, historicalTxs);
      // Handle edge case: zScore null (σ=0, amount≠mean) → Z tidak terdefinisi → ANOMALY/BLOCK
      const zScoreLevel = (fraudResult.zScore === null)
        ? 'ANOMALY'
        : (fraudResult.zScore <= 2 ? 'NORMAL' : fraudResult.zScore <= 3 ? 'SUSPICIOUS' : 'ANOMALY');

      // BLOCK: Tolak transaksi, catat sebagai percobaan fraud
      if (fraudResult.decision === 'BLOCK') {
        await prisma.fraudAlert.create({
          data: {
            userId: Number(senderId),
            deviceId: deviceId || 'unknown',
            deviceName: 'Mobile App',
            // zScore null = edge case sigma=0 (Z tidak terdefinisi). Simpan -1 sebagai sentinel.
            riskScore: fraudResult.zScore ?? -1,
            riskLevel: 'ANOMALY',
            decision: 'BLOCK',
            reasons: JSON.stringify(fraudResult.reasons),
            confidence: 0.997,
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore,
              mean: fraudResult.mean,
              stdDev: fraudResult.stdDev,
              variance: fraudResult.variance,
              n: fraudResult.n,
              currentAmount: amountNum,
              algorithm: 'Z-Score Based Anomaly Detection',
              thresholds: { allow: 2, review: 3 }
            }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
        return res.status(403).json({
          error: 'Transaksi diblokir – anomali terdeteksi (Z-Score > 3)',
          zScore: fraudResult.zScore,
          riskLevel: 'ANOMALY',
          decision: 'BLOCK',
          reasons: fraudResult.reasons,
          mean: fraudResult.mean,
          stdDev: fraudResult.stdDev,
          historyCount: fraudResult.n
        });
      }

      // ALLOW / REVIEW: Proses transaksi, perbarui saldo
      const transaction = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: Number(senderId) },
          data: { balance: { decrement: amountNum } },
        });

        await tx.user.update({
          where: { id: receiver.id },
          data: { balance: { increment: amountNum } },
        });

        const created = await tx.transaction.create({
          data: {
            senderId: Number(senderId),
            receiverId: receiver.id,
            amount: amountNum,
            description,
            deviceId,
            fraudRiskScore: fraudResult.zScore ?? null,  // Float? di schema — null saat edge case sigma=0
            fraudRiskLevel: zScoreLevel,
            fraudReasons: JSON.stringify(fraudResult.reasons),
            ipAddress: req.ip,
          },
          include: {
            sender: {
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
            },
            receiver: {
              select: { id: true, name: true, username: true, balance: true, deviceId: true },
            },
          },
        });

        return created;
      });

      // REVIEW: Buat fraud alert untuk admin
      if (fraudResult.decision === 'REVIEW') {
        await prisma.fraudAlert.create({
          data: {
            userId: Number(senderId),
            transactionId: transaction.id,
            deviceId: deviceId || 'unknown',
            deviceName: 'Mobile App',
            riskScore: fraudResult.zScore ?? -1,  // -1 = sentinel: Z tidak terdefinisi (σ=0)
            riskLevel: 'SUSPICIOUS',
            decision: 'REVIEW',
            reasons: JSON.stringify(fraudResult.reasons),
            confidence: 0.95,
            riskFactors: JSON.stringify({
              zScore: fraudResult.zScore,
              mean: fraudResult.mean,
              stdDev: fraudResult.stdDev,
              variance: fraudResult.variance,
              n: fraudResult.n,
              currentAmount: amountNum,
              algorithm: 'Z-Score Based Anomaly Detection',
              thresholds: { allow: 2, review: 3 }
            }),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
        });
      }

      // Emit realtime
      if (req.io) {
        req.io.to('admin-room').emit('new-transaction', { transaction, fraudResult });
        if (transaction.sender?.deviceId) {
          req.io.to(`device-${transaction.sender.deviceId}`).emit('balance-updated', {
            balance: transaction.sender.balance,
          });
        }
        if (transaction.receiver?.deviceId) {
          req.io.to(`device-${transaction.receiver.deviceId}`).emit('balance-updated', {
            balance: transaction.receiver.balance,
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Transaksi berhasil diselesaikan',
        transaction,
        fraudResult,
      });
    } catch (error) {
      console.error('❌ Kesalahan membuat transaksi:', error);
      res.status(500).json({ error: 'Gagal membuat transaksi' });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                      DAPATKAN TRANSAKSI BERDASARKAN ID                     */
/* -------------------------------------------------------------------------- */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (error) {
    console.error('❌ Kesalahan mendapatkan transaksi:', error);
    res.status(500).json({ error: 'Gagal mendapatkan transaksi' });
  }
});

module.exports = router;
