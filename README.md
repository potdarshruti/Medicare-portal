# Medicare-portal
> A lightweight pharmacy inventory and dispensing portal with a Bootstrap frontend and Python Flask backend API.

![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=flat&logo=flask&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-563D7C?style=flat&logo=bootstrap&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat&logo=sqlite&logoColor=white)


---
 
## About The Project
 
Medicare Portal is a pharmacy management system that helps pharmacists manage medicine inventory, track dispensing events, monitor expiry dates, and generate activity reports — all through a clean, responsive web interface.
 
Built with a vanilla JS + Bootstrap frontend and a Python Flask REST API backend.
 
---

## Features

1. Add / delete medicines.
2. Dispense medicines with patient recording.
3. Notifications for near-expiry and low stock.
4. Activity history / report and ability to clear history.
5. Simple, responsive Bootstrap UI.

---

## 🖼️ Screenshots

![Login](Screenshot/login.png)
![Add Medicine](Screenshot/AddMedicine.png)
![Dispense](Screenshot/Dispense.png)
![Delete Medicine](Screenshot/Delete.png)
![Stock](Screenshot/Stock.png)
![Report](Screenshot/Report.png)
![Notification](Screenshot/Notification.png)

---

## Tech Stack
 
| Layer | Technology |
|---|---|
| Frontend | HTML5, Bootstrap, Vanilla JavaScript |
| Backend | Python, Flask |
| Database | SQLite3 |
| API | REST API (Flask) |
 
---

## Project Structure
 
```
Medicare-portal/
├── project.html        # Main frontend UI
├── server.py           # Flask backend API
├── create_database.sql # Database schema
├── requirements.txt    # Python dependencies
├── Screenshot/         # Project screenshots
└── .gitignore
```
 
---

### Steps
 
1. Clone the repository
```bash
git clone https://github.com/potdarshruti/Medicare-portal.git
cd Medicare-portal
```
 
2. Install Python dependencies
```bash
pip install -r requirements.txt
```
 
3. Set up the database
```bash
sqlite3 medicare.db < create_database.sql
```
 
4. Start the backend server
```bash
python server.py
```
 
5. Open your browser and go to
```
http://localhost:5000
```
 
---

## How to Use

Login using the admin credentials configured in the UI (admin / admin123 by default).
Add medicines via the **Add Medicine** form.
Use **Dispense** to record dispensing events and reduce stock.
View **Notification** for expiry/low-stock alerts.
Use **Report** to view activity history and clear it when needed.

---

## Future Improvements
 
- [ ] Add user authentication with JWT
- [ ] Add role-based access (admin vs pharmacist)
- [ ] Deploy on cloud (Render / Railway)
- [ ] Add medicine search and filter
- [ ] Export reports as PDF

---
 
##  Author
 
**Shruti Potdar**  
B.Tech CSE | Sharad Institute of Technology, Kolhapur  
 
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/potdarshruti)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white)](https://github.com/potdarshruti)
 
---
 
*Built with ❤️ during 2nd year of B.Tech CSE*
