const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const config = require('./config/config');
const db = require('./models');
const apiRoutes = require('./routes');
const errorMiddleware = require('./middlewares/errorMiddleware');
const waService = require('./services/whatsappService');
const { startJobWorker } = require('./services/jobWorker');

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

// Pass IO to WhatsApp service for realtime events
waService.setIO(io);

// Socket.IO connection handler
io.on('connection', (socket) => {
	console.log(`[Socket.IO] Client connected: ${socket.id}`);

	// Send current statuses when client connects
	socket.emit('device:all_statuses', waService.getAllStatuses());

	socket.on('disconnect', () => {
		console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
	});
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
	res.json({ status: 'ok', service: 'wa-blast-backend' });
});

app.use('/api', apiRoutes);
app.use(errorMiddleware);

const start = async () => {
	try {
		await db.sequelize.authenticate();
		startJobWorker();
		httpServer.listen(config.app.port, () => {
			console.log(`Server listening on port ${config.app.port}`);
			console.log(`Socket.IO ready`);
		});
	} catch (error) {
		console.error('Failed to start server:', error.message);
		process.exit(1);
	}
};

start();