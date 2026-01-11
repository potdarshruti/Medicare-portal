from flask import Flask, request, jsonify
from flask_cors import CORS
import pyodbc
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# SQL Server connection string
SERVER = 'Shruti\\SQLEXPRESS'
DATABASE = 'MedicalInventory'
DRIVER = 'SQL Server'
CONNECTION_STRING = f'DRIVER={{{DRIVER}}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

def get_db_connection():
    return pyodbc.connect(CONNECTION_STRING)

print(f"Using connection string: {CONNECTION_STRING}")  # Debug log

def test_connection():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT @@VERSION')
        version = cursor.fetchone()
        print("Successfully connected to SQL Server. Version:", version[0])
        conn.close()
        return True
    except Exception as e:
        print("Error connecting to database:", str(e))
        return False

# Test connection when server starts
test_connection()

def get_db_connection():
    return pyodbc.connect(CONNECTION_STRING)

# Database initialization
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create medicines table if it doesn't exist
    cursor.execute('''
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
    ''')
    
    # Create history table if it doesn't exist
    cursor.execute('''
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
    ''')
    
    conn.commit()
    conn.close()

# Initialize database when server starts
try:
    init_db()
    print("Database initialized successfully")
except Exception as e:
    print(f"Error initializing database: {str(e)}")

# API Routes
@app.route('/api/medicines', methods=['GET'])
def get_medicines():
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Get medicines directly without JOIN to prevent duplicates
        cursor.execute('SELECT id, name, batch, expiry, brand, supplier, quantity FROM medicines')
        medicines = cursor.fetchall()
        
        # Convert to list of dictionaries
        medicines_list = []
        seen_ids = set()  # To prevent duplicates
        
        for m in medicines:
            medicine_id = m[0]
            if medicine_id not in seen_ids:  # Only add if we haven't seen this ID before
                seen_ids.add(medicine_id)
                medicines_list.append({
                    'id': medicine_id,
                    'name': m[1],
                    'batch': m[2],
                    'expiry': m[3].strftime('%Y-%m-%d') if hasattr(m[3], 'strftime') else str(m[3]),
                    'brand': m[4],
                    'supplier': m[5],
                    'quantity': m[6]
                })
        return jsonify(medicines_list)
    except Exception as e:
        print(f"Error getting medicines: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/medicines', methods=['POST'])
def add_medicine():
    data = request.json
    print("Received data:", data)  # Debug log
    
    try:
        # Validate required fields
        required_fields = ['name', 'batch', 'expiry', 'brand', 'supplier', 'quantity']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
            if not data[field]:
                return jsonify({'error': f'Field {field} cannot be empty'}), 400
                
        # Validate quantity is a positive number
        try:
            quantity = int(data['quantity'])
            if quantity <= 0:
                return jsonify({'error': 'Quantity must be greater than 0'}), 400
        except ValueError:
            return jsonify({'error': 'Quantity must be a valid number'}), 400
            
        conn = get_db_connection()
        print("Database connected successfully")  # Debug log
        cursor = conn.cursor()
        
        # Check if medicine with same batch already exists
        cursor.execute('''
            SELECT id, quantity FROM medicines 
            WHERE name = ? AND batch = ?
        ''', (data['name'], data['batch']))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing medicine quantity
            new_quantity = existing[1] + quantity
            cursor.execute('''
                UPDATE medicines 
                SET quantity = ? 
                WHERE id = ?
            ''', (new_quantity, existing[0]))
        else:
            # Insert new medicine
            cursor.execute('''
                INSERT INTO medicines (name, batch, expiry, brand, supplier, quantity)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (data['name'], data['batch'], data['expiry'], 
                  data['brand'], data['supplier'], quantity))
        
        # Record in history
        cursor.execute('''
            INSERT INTO history (type, medicine_name, batch, quantity, person)
            VALUES (?, ?, ?, ?, ?)
        ''', ('ADD', data['name'], data['batch'], quantity, 'system'))
        print("Database operations completed successfully")  # Debug log
        
        conn.commit()
        print("Transaction committed successfully")  # Debug log
        return jsonify({'message': 'Medicine added successfully'}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        conn.close()

@app.route('/api/medicines/<int:id>', methods=['DELETE'])
def delete_medicine(id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Get medicine details before deletion
        cursor.execute('SELECT name, batch FROM medicines WHERE id = ?', (id,))
        med = cursor.fetchone()
        if not med:
            return jsonify({'error': 'Medicine not found'}), 404
            
        # Delete medicine
        cursor.execute('DELETE FROM medicines WHERE id = ?', (id,))
        
        # Record in history
        cursor.execute('''
            INSERT INTO history (type, medicine_name, batch, quantity, person)
            VALUES (?, ?, ?, ?, ?)
        ''', ('DELETE', med[0], med[1], 0, 'system'))
        
        conn.commit()
        return jsonify({'message': 'Medicine deleted successfully'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        conn.close()

@app.route('/api/dispense', methods=['POST'])
def dispense_medicine():
    print("Dispense request received")
    data = request.json
    print("Request data:", data)
    
    # Validate input
    if not data or 'medicine_id' not in data or 'quantity' not in data or 'patient' not in data:
        print("Missing required fields in request")
        return jsonify({'error': 'Missing required fields'}), 400
        
    try:
        medicine_id = int(data['medicine_id'])
        quantity = int(data['quantity'])
        patient = str(data['patient']).strip()
        print(f"Parsed data - medicine_id: {medicine_id}, quantity: {quantity}, patient: {patient}")
    except (ValueError, TypeError) as e:
        print(f"Data format error: {str(e)}")
        return jsonify({'error': 'Invalid data format'}), 400
        
    if quantity <= 0:
        return jsonify({'error': 'Quantity must be greater than 0'}), 400
    if not patient:
        return jsonify({'error': 'Patient name is required'}), 400
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if medicine exists and has enough quantity
        cursor.execute('SELECT name, batch, quantity FROM medicines WHERE id = ?', (medicine_id,))
        med = cursor.fetchone()
        print(f"Medicine query result: {med}")
        if not med:
            print(f"Medicine with ID {medicine_id} not found")
            return jsonify({'error': 'Medicine not found'}), 404
            
        current_qty = med[2]
        print(f"Current quantity: {current_qty}, Requested: {quantity}")
        if current_qty < quantity:
            print(f"Insufficient quantity. Available: {current_qty}, Requested: {quantity}")
            return jsonify({'error': f'Insufficient quantity. Available: {current_qty}'}), 400
        
        # Update medicine quantity
        new_qty = current_qty - quantity
        cursor.execute('''
            UPDATE medicines SET quantity = ? 
            WHERE id = ?
        ''', (new_qty, medicine_id))
        
        # Record in history
        cursor.execute('''
            INSERT INTO history (type, medicine_name, batch, quantity, person)
            VALUES (?, ?, ?, ?, ?)
        ''', ('DISPENSE', med[0], med[1], quantity, patient))
        
        # If quantity is 0, delete the medicine
        if new_qty == 0:
            cursor.execute('DELETE FROM medicines WHERE id = ?', (medicine_id,))
        
        conn.commit()
        return jsonify({'message': 'Medicine dispensed successfully', 
                       'medicine': med[0], 
                       'quantity': quantity,
                       'remaining': new_qty})
                       
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error dispensing medicine: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn:
            conn.close()

@app.route('/api/history', methods=['GET'])
def get_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT TOP 200 * FROM history ORDER BY timestamp DESC')
    history = cursor.fetchall()
    conn.close()
    
    # Convert to list of dictionaries
    history_list = []
    for h in history:
        history_list.append({
            'id': h[0],
            'type': h[1],
            'medicine_name': h[2],
            'batch': h[3],
            'quantity': h[4],
            'person': h[5],
            'timestamp': h[6].strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(history_list)


@app.route('/api/stock_in', methods=['GET'])
def get_stock_in():
    """Return history entries where type is 'ADD' (stock in events)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT TOP 200 * FROM history WHERE type = 'ADD' ORDER BY timestamp DESC")
    stock_in = cursor.fetchall()
    conn.close()

    stock_in_list = []
    for s in stock_in:
        stock_in_list.append({
            'id': s[0],
            'type': s[1],
            'medicine_name': s[2],
            'batch': s[3],
            'quantity': s[4],
            'person': s[5],
            'timestamp': s[6].strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(stock_in_list)


@app.route('/api/report', methods=['GET'])
def get_report():
    """Return a combined report containing current stock and recent history."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Current stock
    cursor.execute('SELECT id, name, batch, expiry, brand, supplier, quantity FROM medicines')
    meds = cursor.fetchall()
    stock = []
    for m in meds:
        stock.append({
            'id': m[0],
            'name': m[1],
            'batch': m[2],
            'expiry': m[3].strftime('%Y-%m-%d'),
            'brand': m[4],
            'supplier': m[5],
            'quantity': m[6]
        })

    # Recent history
    cursor.execute('SELECT TOP 500 * FROM history ORDER BY timestamp DESC')
    history = cursor.fetchall()
    history_list = []
    for h in history:
        history_list.append({
            'id': h[0],
            'type': h[1],
            'medicine_name': h[2],
            'batch': h[3],
            'quantity': h[4],
            'person': h[5],
            'timestamp': h[6].strftime('%Y-%m-%d %H:%M:%S')
        })

    conn.close()
    return jsonify({'stock': stock, 'history': history_list})

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('DELETE FROM history')
        conn.commit()
        return jsonify({'message': 'History cleared successfully'})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)
