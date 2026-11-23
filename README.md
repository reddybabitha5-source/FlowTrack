
# 🚀 FlowTrack – Project Management Portal

FlowTrack is a web-based project management portal designed to simplify project requests, booking management, and project progress tracking.

It provides a platform where customers can submit project requests and monitor their progress, while administrators can manage customers, handle bookings, and update project statuses through an admin dashboard.

## 📌 Project Overview

FlowTrack helps customers and administrators manage project activities in one place.

Customers can submit work requests, view project details, and track progress. Administrators can manage customer information, review booking requests, update project progress, and monitor overall project activities.

## ✨ Features

### 👤 Customer Features
- Customer Registration and Login
- Customer Dashboard
- Submit New Project Requests
- Select Services
- Provide Project Details and Budget
- Track Project Status
- View Project Progress Updates
- Contact Admin through Email, Phone, and WhatsApp

### 🛠️ Admin Features
- Admin Login
- Admin Dashboard
- View Dashboard Statistics
- Manage Customers
- View and Manage Booking Requests
- Accept or Reject Project Requests
- Update Project Progress
- Add Project Stages and Progress Percentages
- View Project Reports

## 💻 Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Web page structure |
| CSS3 | Styling and responsive design |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Backend framework and APIs |
| MySQL | Database management |

## 📂 Project Structure

```text
FlowTrack/
│
├── frontend/
│   ├── index.html
│   └── admin-dashboard.html
│
├── backend/
│   ├── app.js
│   ├── package.json
│   ├── routes/
│   └── other backend files
│
└── README.md
```

*The structure above is an example. Adjust it to match your actual project files.*

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/reddybabitha5-source/FlowTrack.git
```

### 2. Open the Project Folder

```bash
cd FlowTrack
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Configure MySQL Database

- Start your MySQL server.
- Create the FlowTrack database.
- Import or execute your project SQL table creation scripts.
- Configure your database connection settings in the backend.
- Keep database passwords and secret credentials in a private `.env` file.

### 5. Start the Backend

```bash
node app.js
```

The backend runs on:

```text
http://localhost:5001
```

### 6. Open the Frontend

Open the frontend `index.html` using VS Code Live Server or another local web server.

## 🗄️ Database

FlowTrack uses MySQL to store project and customer information.

Main database tables include:

- customers
- admin_users
- services
- bookings
- project_updates
- messages

## 🎯 Project Objective

The main objective of FlowTrack is to provide a simple and organized platform for managing customer project requests and tracking project progress efficiently.

## 🚀 Future Enhancements

- Email Notifications
- Advanced Project Reports
- File Upload Support
- Improved User Experience
- Enhanced Security and Authentication

## 👩‍💻 Developer

**Babitha Reddy**

GitHub: https://github.com/reddybabitha5-source

---

⭐ If you find this project interesting, feel free to explore the repository!
