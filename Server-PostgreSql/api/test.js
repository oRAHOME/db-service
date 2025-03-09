const { Pool } = require('pg');

// Create the pool with your connection string
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_SWUg7ubs6hJK@ep-soft-forest-aah9ymy9-pooler.westus3.azure.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // 5 second timeout for connection attempts
});

// Function to ensure items table exists
const ensureItemsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return { success: true, message: 'Items table created or already exists' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Function to insert dummy data
const insertDummyData = async () => {
  try {
    // First create the table if it doesn't exist
    const tableResult = await ensureItemsTable();
    if (!tableResult.success) {
      return tableResult;
    }
    
    // Insert dummy data
    const result = await pool.query(`
      INSERT INTO items (name, description) VALUES 
      ('Laptop', 'A portable computer'),
      ('Smartphone', 'A mobile phone with advanced features'),
      ('Headphones', 'A pair of audio devices'),
      ('Monitor', 'A display screen'),
      ('Keyboard', 'An input device for typing')
      RETURNING id, name, description, created_at
    `);
    
    return { 
      success: true, 
      message: 'Dummy data inserted successfully',
      count: result.rowCount,
      items: result.rows
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Test the connection by querying current time
    const startTime = Date.now();
    const { rows } = await pool.query('SELECT NOW() as server_time');
    const endTime = Date.now();
    
    // Get server version info
    const versionResult = await pool.query('SELECT version() as version');
    
    // Get connection info
    const connectionResult = await pool.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_address,
        inet_server_port() as server_port
    `);
    
    // Check if our items table exists
    let tableExists = false;
    let itemsCount = 0;
    
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'items'
        ) as exists
      `);
      tableExists = tableCheck.rows[0].exists;
      
      if (tableExists) {
        const countResult = await pool.query('SELECT COUNT(*) as count FROM items');
        itemsCount = parseInt(countResult.rows[0].count);
      }
    } catch (tableError) {
      console.error('Error checking for table:', tableError);
    }
    
    // Handle POST request to insert dummy data
    let dummyDataResult = null;
    if (req.method === 'POST') {
      dummyDataResult = await insertDummyData();
    }
    
    // Return successful connection details
    return res.status(200).json({
      connected: true,
      serverTime: rows[0].server_time,
      responseTime: `${endTime - startTime}ms`,
      serverVersion: versionResult.rows[0].version,
      connection: connectionResult.rows[0],
      tables: {
        itemsTableExists: tableExists,
        itemsCount: itemsCount
      },
      dummyData: dummyDataResult,
      message: 'Successfully connected to Neon PostgreSQL database'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    
    // Return detailed error information
    return res.status(500).json({
      connected: false,
      error: error.message,
      errorCode: error.code,
      errorDetails: {
        hostname: error.address,
        port: error.port,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall
      },
      message: 'Failed to connect to Neon PostgreSQL database'
    });
  } finally {
    // Best practice: end the pool when done to prevent connection leaks
    try {
      await pool.end();
    } catch (endError) {
      console.error('Error ending connection pool:', endError);
    }
  }
};