const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(express.json());

// ─── SQL Server Config ─────────────────────────────────────────────────────────
const dbConfig = {
  server:   'Shruti\\SQLEXPRESS',
  database: 'Medicare_Portal',
  user:     'sa',
  password: 'Medicare@123',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

// ─── Connection pool ───────────────────────────────────────────────────────────
let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('Connected to SQL Server:', dbConfig.server, '/', dbConfig.database);
  }
  return pool;
}

// ─── Init DB ───────────────────────────────────────────────────────────────────
async function initDb() {
  const p = await getPool();

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='medicines')
    CREATE TABLE medicines (
      id        INT IDENTITY(1,1) PRIMARY KEY,
      name      NVARCHAR(100) NOT NULL,
      batch     NVARCHAR(50)  NOT NULL,
      expiry    DATE          NOT NULL,
      brand     NVARCHAR(100) NOT NULL,
      supplier  NVARCHAR(100) NOT NULL,
      quantity  INT           NOT NULL
    )
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='history')
    CREATE TABLE history (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      type          NVARCHAR(50)  NOT NULL,
      medicine_name NVARCHAR(100) NOT NULL,
      batch         NVARCHAR(50)  NOT NULL,
      quantity      INT           NOT NULL,
      person        NVARCHAR(100) NOT NULL,
      timestamp     DATETIME DEFAULT GETDATE()
    )
  `);

  console.log('Database initialized successfully');
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.replace('T', ' ').slice(0, 19);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

// ─── GET /api/medicines ────────────────────────────────────────────────────────
app.get('/api/medicines', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(
      'SELECT id, name, batch, expiry, brand, supplier, quantity FROM medicines'
    );
    const seen = new Set();
    const list = [];
    for (const m of result.recordset) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          id: m.id, name: m.name, batch: m.batch,
          expiry: fmtDate(m.expiry), brand: m.brand,
          supplier: m.supplier, quantity: m.quantity,
        });
      }
    }
    res.json(list);
  } catch (err) {
    console.error('Error getting medicines:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/medicines ───────────────────────────────────────────────────────
app.post('/api/medicines', async (req, res) => {
  const data = req.body;
  const required = ['name', 'batch', 'expiry', 'brand', 'supplier', 'quantity'];
  for (const field of required) {
    if (!data[field] && data[field] !== 0)
      return res.status(400).json({ error: `Missing required field: ${field}` });
  }
  const quantity = parseInt(data.quantity);
  if (isNaN(quantity) || quantity <= 0)
    return res.status(400).json({ error: 'Quantity must be a positive number' });

  try {
    const p = await getPool();
    const existing = await p.request()
      .input('name',  sql.NVarChar, data.name)
      .input('batch', sql.NVarChar, data.batch)
      .query('SELECT id, quantity FROM medicines WHERE name=@name AND batch=@batch');

    if (existing.recordset.length > 0) {
      const { id, quantity: oldQty } = existing.recordset[0];
      await p.request()
        .input('qty', sql.Int, oldQty + quantity)
        .input('id',  sql.Int, id)
        .query('UPDATE medicines SET quantity=@qty WHERE id=@id');
    } else {
      await p.request()
        .input('name',     sql.NVarChar, data.name)
        .input('batch',    sql.NVarChar, data.batch)
        .input('expiry',   sql.Date,     data.expiry)
        .input('brand',    sql.NVarChar, data.brand)
        .input('supplier', sql.NVarChar, data.supplier)
        .input('quantity', sql.Int,      quantity)
        .query(`INSERT INTO medicines (name,batch,expiry,brand,supplier,quantity)
                VALUES (@name,@batch,@expiry,@brand,@supplier,@quantity)`);
    }

    await p.request()
      .input('type',   sql.NVarChar, 'ADD')
      .input('name',   sql.NVarChar, data.name)
      .input('batch',  sql.NVarChar, data.batch)
      .input('qty',    sql.Int,      quantity)
      .input('person', sql.NVarChar, 'system')
      .query(`INSERT INTO history (type,medicine_name,batch,quantity,person)
              VALUES (@type,@name,@batch,@qty,@person)`);

    res.status(201).json({ message: 'Medicine added successfully' });
  } catch (err) {
    console.error('Error adding medicine:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─── DELETE /api/medicines/:id ─────────────────────────────────────────────────
app.delete('/api/medicines/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const p = await getPool();
    const result = await p.request()
      .input('id', sql.Int, id)
      .query('SELECT name, batch FROM medicines WHERE id=@id');

    if (result.recordset.length === 0)
      return res.status(404).json({ error: 'Medicine not found' });

    const { name, batch } = result.recordset[0];
    await p.request().input('id', sql.Int, id).query('DELETE FROM medicines WHERE id=@id');
    await p.request()
      .input('type',   sql.NVarChar, 'DELETE')
      .input('name',   sql.NVarChar, name)
      .input('batch',  sql.NVarChar, batch)
      .input('qty',    sql.Int,      0)
      .input('person', sql.NVarChar, 'system')
      .query(`INSERT INTO history (type,medicine_name,batch,quantity,person)
              VALUES (@type,@name,@batch,@qty,@person)`);

    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/dispense ────────────────────────────────────────────────────────
app.post('/api/dispense', async (req, res) => {
  const data = req.body;
  if (!data || data.medicine_id == null || data.quantity == null || !data.patient)
    return res.status(400).json({ error: 'Missing required fields' });

  const medicine_id = parseInt(data.medicine_id);
  const quantity    = parseInt(data.quantity);
  const patient     = String(data.patient).trim();

  if (isNaN(medicine_id) || isNaN(quantity))
    return res.status(400).json({ error: 'Invalid data format' });
  if (quantity <= 0)
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  if (!patient)
    return res.status(400).json({ error: 'Patient name is required' });

  try {
    const p = await getPool();
    const result = await p.request()
      .input('id', sql.Int, medicine_id)
      .query('SELECT name, batch, quantity FROM medicines WHERE id=@id');

    if (result.recordset.length === 0)
      return res.status(404).json({ error: 'Medicine not found' });

    const { name, batch, quantity: currentQty } = result.recordset[0];
    if (currentQty < quantity)
      return res.status(400).json({ error: `Insufficient quantity. Available: ${currentQty}` });

    const newQty = currentQty - quantity;
    await p.request()
      .input('qty', sql.Int, newQty)
      .input('id',  sql.Int, medicine_id)
      .query('UPDATE medicines SET quantity=@qty WHERE id=@id');

    await p.request()
      .input('type',   sql.NVarChar, 'DISPENSE')
      .input('name',   sql.NVarChar, name)
      .input('batch',  sql.NVarChar, batch)
      .input('qty',    sql.Int,      quantity)
      .input('person', sql.NVarChar, patient)
      .query(`INSERT INTO history (type,medicine_name,batch,quantity,person)
              VALUES (@type,@name,@batch,@qty,@person)`);

    if (newQty === 0)
      await p.request().input('id', sql.Int, medicine_id).query('DELETE FROM medicines WHERE id=@id');

    res.json({ message: 'Medicine dispensed successfully', medicine: name, quantity, remaining: newQty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/history ─────────────────────────────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(
      'SELECT TOP 200 * FROM history ORDER BY timestamp DESC'
    );
    res.json(result.recordset.map(h => ({
      id: h.id, type: h.type, medicine_name: h.medicine_name,
      batch: h.batch, quantity: h.quantity, person: h.person,
      timestamp: fmtDateTime(h.timestamp),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/stock_in ────────────────────────────────────────────────────────
app.get('/api/stock_in', async (req, res) => {
  try {
    const p = await getPool();
    const result = await p.request().query(
      "SELECT TOP 200 * FROM history WHERE type='ADD' ORDER BY timestamp DESC"
    );
    res.json(result.recordset.map(s => ({
      id: s.id, type: s.type, medicine_name: s.medicine_name,
      batch: s.batch, quantity: s.quantity, person: s.person,
      timestamp: fmtDateTime(s.timestamp),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/report ──────────────────────────────────────────────────────────
app.get('/api/report', async (req, res) => {
  try {
    const p = await getPool();
    const medsResult = await p.request().query(
      'SELECT id, name, batch, expiry, brand, supplier, quantity FROM medicines'
    );
    const stock = medsResult.recordset.map(m => ({
      id: m.id, name: m.name, batch: m.batch, expiry: fmtDate(m.expiry),
      brand: m.brand, supplier: m.supplier, quantity: m.quantity,
    }));
    const histResult = await p.request().query(
      'SELECT TOP 500 * FROM history ORDER BY timestamp DESC'
    );
    const history = histResult.recordset.map(h => ({
      id: h.id, type: h.type, medicine_name: h.medicine_name,
      batch: h.batch, quantity: h.quantity, person: h.person,
      timestamp: fmtDateTime(h.timestamp),
    }));
    res.json({ stock, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/history/clear ──────────────────────────────────────────────────
app.post('/api/history/clear', async (req, res) => {
  try {
    const p = await getPool();
    await p.request().query('DELETE FROM history');
    res.json({ message: 'History cleared successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
