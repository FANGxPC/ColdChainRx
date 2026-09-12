const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Placeholder route for batch verification
app.get('/verify/:batchId', async (req, res) => {
    const { batchId } = req.params;

    try {
        // Generate a QR code for a dummy batch ID URL
        const verificationUrl = `http://localhost:5173/verify/${batchId}`;
        const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

        // Dummy data (not yet connected to ledger)
        const dummyBatchData = {
            batchId: batchId,
            status: "Authentic",
            drugName: "Vaccine-X",
            message: "Placeholder data. Fabric ledger connection pending."
        };

        res.json({
            success: true,
            data: dummyBatchData,
            qrCode: qrCodeDataUrl
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate QR code' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
