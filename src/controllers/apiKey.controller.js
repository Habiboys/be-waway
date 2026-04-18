const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { ApiKey } = require('../models');

const maskApiKey = (key) => {
	if (!key || key.length < 12) return '***';
	return `${key.slice(0, 8)}...${key.slice(-4)}`;
};

const generateApiKey = () => {
	return `waway_${crypto.randomBytes(24).toString('hex')}`;
};

exports.list = asyncHandler(async (req, res) => {
	const rows = await ApiKey.findAll({
		where: { organization_id: req.organizationId },
		order: [['id', 'DESC']],
	});

	res.json(
		rows.map((row) => ({
			id: row.id,
			organization_id: row.organization_id,
			key_preview: maskApiKey(row.api_key),
			is_active: row.is_active,
			created_at: row.created_at,
		}))
	);
});

exports.create = asyncHandler(async (req, res) => {
	await ApiKey.update(
		{ is_active: false },
		{
			where: {
				organization_id: req.organizationId,
				is_active: true,
			},
		}
	);

	const apiKeyValue = generateApiKey();
	const row = await ApiKey.create({
		organization_id: req.organizationId,
		api_key: apiKeyValue,
		is_active: true,
		created_at: new Date(),
	});

	res.status(201).json({
		message: 'API key generated',
		api_key: apiKeyValue,
		key_id: row.id,
		organization_id: row.organization_id,
		is_active: row.is_active,
		created_at: row.created_at,
		note: 'Simpan API key ini sekarang. Key lama otomatis tidak berlaku.',
	});
});

exports.remove = asyncHandler(async (req, res) => {
	const row = await ApiKey.findOne({
		where: {
			id: req.params.id,
			organization_id: req.organizationId,
		},
	});

	if (!row) {
		return res.status(404).json({ message: 'API key not found' });
	}

	await row.update({ is_active: false });

	return res.status(204).send();
});
