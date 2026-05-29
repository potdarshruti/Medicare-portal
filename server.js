const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
app.use(cors());
app.use(express.json());

const config = {
  server: 'LAPTOP-BO75CL7T\\SQLEXPRESS',
  database: 'Medicare_Portal',
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
};

async function getPool() {
  return await sql.connect(config);
}

// Init DB tables
async function initDb() {
  const pool = await getPool();
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='medicines')
    CREATE TABLE medicines (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(100) NOT NULL,
      batch NVARCHAR(50) NOT NULL,
      expiry DATE NOT NULL,
      brand NVARCHAR(100) NOT NULL,
      supplier NVARCHAR(100) NOT NULL,
      quantity INT NOT NULL
    )
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name='history')
    CREATE TABLE history (
      id INT IDENTITY(1,1) PRIMARY KEY,
      type NVARCHAR(50) NOT NULL,
      medicine_name NVARCHAR(100) NOT NULL,
      batch NVARCHAR(50) NOT NULL,
      quantity INT NOT NULL,
      person NVARCHAR(100) NOT NULL,
      timestamp DATETIME DEFAULT GETDATE()
    )
  `);
  console.log('Database initialized successfully');
}

// GET /api/medicines
app.get('/api/medicines', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT id, name, batch, expiry, brand, supplier, quantity FROM medicines');
    const medicines = result.recordset.map(m => ({
      ...m,
      expiry: m.expiry ? m.expiry.toISOString().split('T')[0] : null,
    }));
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/medicines
app.post('/api/medicines', async (req, res) => {
  const data = req.body;
  const required = ['name', 'batch', 'expiry', 'brand', 'supplier', 'quantity'];
  for (const field of required) {
    if (!data[field]) return res.status(400).json({ error: `Missing field: ${field}` });
  }
  const quantity = parseInt(data.quantity);
  if (isNaN(quantity) || quantity <= 0)
    return res.status(400).json({ error: 'Quantity must be a positive number' });

  try {
    const pool = await getPool();
    const existing = await pool.request()
      .input('name', sql.NVarChar, data.name)
      .input('batch', sql.NVarChar, data.batch)
      .query('SELECT id, quantity FROM medicines WHERE name=@name AND batch=@batch');

    if (existing.recordset.length > 0) {
      const { id, quantity: oldQty } = existing.recordset[0];
      await pool.request()
        .input('qty', sql.Int, oldQty + quantity)
        .input('id', sql.Int, id)
        .query('UPDATE medicines SET quantity=@qty WHERE id=@id');
    } else {
      await pool.request()
        .input('name', sql.NVarChar, data.name)
        .input('batch', sql.NVarChar, data.batch)
        .input('expiry', sql.Date, data.expiry)
        .input('brand', sql.NVarChar, data.brand)
        .input('supplier', sql.NVarChar, data.supplier)
        .input('quantity', sql.Int, quantity)
        .query('INSERT INTO medicines (name,batch,expiry,brand,supplier,quantity) VALUES (@name,@batch,@expiry,@brand,@supplier,@quantity)');
    }
    await pool.request()
      .input('type', sql.NVarChar, 'ADD')
      .input('med', sql.NVarChar, data.name)
      .input('batch', sql.NVarChar, data.batch)
      .input('qty', sql.Int, quantity)
      .input('person', sql.NVarChar, 'system')
      .query('INSERT INTO history (type,medicine_name,batch,quantity,person) VALUES (@type,@med,@batch,@qty,@person)');

    res.status(201).json({ message: 'Medicine added successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/medicines/:id
app.delete('/api/medicines/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const pool = await getPool();
    const med = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT name, batch FROM medicines WHERE id=@id');
    if (!med.recordset.length) return res.status(404).json({ error: 'Medicine not found' });

    const { name, batch } = med.recordset[0];
    await pool.request().input('id', sql.Int, id).query('DELETE FROM medicines WHERE id=@id');
    await pool.request()
      .input('type', sql.NVarChar, 'DELETE')
      .input('med', sql.NVarChar, name)
      .input('batch', sql.NVarChar, batch)
      .input('qty', sql.Int, 0)
      .input('person', sql.NVarChar, 'system')
      .query('INSERT INTO history (type,medicine_name,batch,quantity,person) VALUES (@type,@med,@batch,@qty,@person)');

    res.json({ message: 'Medicine deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/dispense
app.post('/api/dispense', async (req, res) => {
  const { medicine_id, quantity, patient } = req.body;
  if (!medicine_id || !quantity || !patient)
    return res.status(400).json({ error: 'Missing required fields' });

  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid quantity' });

  try {
    const pool = await getPool();
    const med = await pool.request()
      .input('id', sql.Int, medicine_id)
      .query('SELECT name, batch, quantity FROM medicines WHERE id=@id');
    if (!med.recordset.length) return res.status(404).json({ error: 'Medicine not found' });

    const { name, batch, quantity: current } = med.recordset[0];
    if (current < qty) return res.status(400).json({ error: `Insufficient quantity. Available: ${current}` });

    const newQty = current - qty;
    await pool.request()
      .input('qty', sql.Int, newQty)
      .input('id', sql.Int, medicine_id)
      .query('UPDATE medicines SET quantity=@qty WHERE id=@id');

    await pool.request()
      .input('type', sql.NVarChar, 'DISPENSE')
      .input('med', sql.NVarChar, name)
      .input('batch', sql.NVarChar, batch)
      .input('qty', sql.Int, qty)
      .input('person', sql.NVarChar, patient)
      .query('INSERT INTO history (type,medicine_name,batch,quantity,person) VALUES (@type,@med,@batch,@qty,@person)');

    if (newQty === 0) {
      await pool.request().input('id', sql.Int, medicine_id).query('DELETE FROM medicines WHERE id=@id');
    }

    res.json({ message: 'Medicine dispensed successfully', medicine: name, quantity: qty, remaining: newQty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history
app.get('/api/history', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT TOP 200 * FROM history ORDER BY timestamp DESC');
    const list = result.recordset.map(h => ({
      ...h,
      timestamp: h.timestamp ? h.timestamp.toISOString().replace('T', ' ').split('.')[0] : null,
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stock_in
app.get('/api/stock_in', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query("SELECT TOP 200 * FROM history WHERE type='ADD' ORDER BY timestamp DESC");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report
app.get('/api/report', async (req, res) => {
  try {
    const pool = await getPool();
    const stock = await pool.request()
      .query('SELECT id,name,batch,expiry,brand,supplier,quantity FROM medicines');
    const history = await pool.request()
      .query('SELECT TOP 500 * FROM history ORDER BY timestamp DESC');
    res.json({ stock: stock.recordset, history: history.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/history/clear
app.post('/api/history/clear', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('DELETE FROM history');
    res.json({ message: 'History cleared successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start server
initDb().then(() => {
  app.listen(5000, () => console.log('Server running on http://localhost:5000'));
}).catch(err => {
  console.error('Failed to initialize DB:', err.message);
});