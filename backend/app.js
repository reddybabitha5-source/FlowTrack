
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./database");

const app = express();
const PORT = process.env.PORT || 5001;

// =====================================
// MIDDLEWARE
// =====================================

app.use(cors());
app.use(express.json());

// Request logger must come before routes
app.use((req, res, next) => {
    console.log("REQUEST:", req.method, req.url);
    next();
});

// =====================================
// HOME ROUTE
// =====================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to FlowTrack API",
        status: "Server running"
    });
});

// =====================================
// DATABASE TEST
// =====================================

app.get("/test-db", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS database_name, 1 AS result"
        );

        res.json({
            success: true,
            message: "Node.js connected to MySQL successfully!",
            database: rows[0].database_name,
            result: rows[0].result
        });

    } catch (error) {
        console.error("Database error:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

// =====================================
// TOKEN VALIDATION
// =====================================

function getToken(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }

    return authHeader.split(" ")[1];
}

function verifyCustomer(req, res, next) {
    const token = getToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Please login first"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "customer" || !decoded.customer_id) {
            return res.status(403).json({
                success: false,
                message: "Customer access only"
            });
        }

        req.customer = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired login token"
        });
    }
}

function verifyAdmin(req, res, next) {
    const token = getToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Admin login required"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "admin" || !decoded.admin_id) {
            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });
        }

        req.admin = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired admin token"
        });
    }
}

// =====================================
// CUSTOMER REGISTRATION
// =====================================

app.post("/api/register", async (req, res) => {
    try {
        const { full_name, email, phone, password } = req.body;

        if (!full_name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const [existing] = await db.query(
            "SELECT customer_id FROM customers WHERE email = ?",
            [normalizedEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            `INSERT INTO customers
            (full_name, email, phone, password_hash)
            VALUES (?, ?, ?, ?)`,
            [
                full_name.trim(),
                normalizedEmail,
                phone.trim(),
                passwordHash
            ]
        );

        res.status(201).json({
            success: true,
            message: "Customer registered successfully",
            customer_id: result.insertId
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
});

// =====================================
// CUSTOMER LOGIN
// =====================================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const [customers] = await db.query(
            "SELECT * FROM customers WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (customers.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const customer = customers[0];

        const isMatch = await bcrypt.compare(
            password,
            customer.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from .env");
        }

        const token = jwt.sign(
            {
                customer_id: customer.customer_id,
                email: customer.email,
                role: "customer"
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            message: "Login successful",
            token,
            customer: {
                customer_id: customer.customer_id,
                full_name: customer.full_name,
                email: customer.email,
                phone: customer.phone,
                shop_name: customer.shop_name,
                address: customer.address
            }
        });

    } catch (error) {
        console.error("Customer login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

// =====================================
// SERVICES
// =====================================

app.get("/api/services", async (req, res) => {
    try {
        const [services] = await db.query(
            `SELECT *
             FROM services
             WHERE is_active = TRUE
             ORDER BY service_id`
        );

        res.json({
            success: true,
            services
        });

    } catch (error) {
        console.error("Services error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load services"
        });
    }
});

// =====================================
// CUSTOMER CREATE BOOKING
// =====================================

app.post("/api/bookings", verifyCustomer, async (req, res) => {
    try {
        const {
            service_id,
            project_title,
            project_description,
            budget,
            preferred_date,
            preferred_time
        } = req.body;

        if (!service_id || !project_title || !project_description) {
            return res.status(400).json({
                success: false,
                message: "Please provide service, project title and description"
            });
        }

        const [services] = await db.query(
            `SELECT service_id
             FROM services
             WHERE service_id = ?
             AND is_active = TRUE`,
            [service_id]
        );

        if (services.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        const [result] = await db.query(
            `INSERT INTO bookings
            (
                customer_id,
                service_id,
                project_title,
                project_description,
                budget,
                preferred_date,
                preferred_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                req.customer.customer_id,
                service_id,
                project_title.trim(),
                project_description.trim(),
                budget || null,
                preferred_date || null,
                preferred_time || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Booking submitted successfully",
            booking_id: result.insertId,
            status: "pending"
        });

    } catch (error) {
        console.error("Booking error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit booking"
        });
    }
});

// =====================================
// CUSTOMER VIEW OWN BOOKINGS
// =====================================

app.get("/api/my-bookings", verifyCustomer, async (req, res) => {
    try {
        const [bookings] = await db.query(
            `SELECT b.*, s.service_name
             FROM bookings b
             INNER JOIN services s
                ON b.service_id = s.service_id
             WHERE b.customer_id = ?
             ORDER BY b.created_at DESC`,
            [req.customer.customer_id]
        );

        res.json({
            success: true,
            bookings
        });

    } catch (error) {
        console.error("My bookings error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load your bookings"
        });
    }
});

// =====================================
// CUSTOMER VIEW PROJECT PROGRESS
// =====================================

app.get("/api/my-progress", verifyCustomer, async (req, res) => {
    try {
        const [progress] = await db.query(
            `SELECT
                b.booking_id,
                b.project_title,
                b.status,
                s.service_name,
                pu.update_id,
                pu.stage_name,
                pu.progress_percentage,
                pu.update_description,
                pu.created_at AS updated_at
             FROM bookings b
             INNER JOIN services s
                ON b.service_id = s.service_id
             LEFT JOIN project_updates pu
                ON b.booking_id = pu.booking_id
             WHERE b.customer_id = ?
             AND b.status IN ('accepted', 'in_progress', 'completed')
             ORDER BY b.created_at DESC, pu.created_at ASC`,
            [req.customer.customer_id]
        );

        res.json({
            success: true,
            progress
        });

    } catch (error) {
        console.error("Customer progress error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load project progress"
        });
    }
});

// =====================================
// ADMIN LOGIN
// =====================================

app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from .env");
        }

        const [admins] = await db.query(
            `SELECT admin_id, full_name, email, password_hash
             FROM admin_users
             WHERE email = ?`,
            [email.trim().toLowerCase()]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const admin = admins[0];

        const isMatch = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                admin_id: admin.admin_id,
                email: admin.email,
                role: "admin"
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            success: true,
            message: "Admin login successful",
            token,
            admin: {
                admin_id: admin.admin_id,
                full_name: admin.full_name,
                email: admin.email
            }
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            success: false,
            message: "Admin login failed"
        });
    }
});

// =====================================
// ADMIN DASHBOARD STATISTICS
// =====================================

app.get(
    "/api/admin/dashboard-stats",
    verifyAdmin,
    async (req, res) => {
        try {
            const [customerCount] = await db.query(
                "SELECT COUNT(*) AS total FROM customers"
            );

            const [bookingStats] = await db.query(
                `SELECT
                    COUNT(*) AS total_requests,
                    SUM(status = 'pending') AS pending_requests,
                    SUM(status = 'accepted') AS accepted_requests,
                    SUM(status = 'rejected') AS rejected_requests,
                    SUM(status = 'in_progress') AS in_progress_projects,
                    SUM(status = 'completed') AS completed_projects
                 FROM bookings`
            );

            const stats = bookingStats[0];

            res.json({
                success: true,
                stats: {
                    total_customers: customerCount[0].total,
                    total_requests: stats.total_requests,
                    pending_requests: stats.pending_requests || 0,
                    accepted_requests: stats.accepted_requests || 0,
                    rejected_requests: stats.rejected_requests || 0,
                    in_progress_projects: stats.in_progress_projects || 0,
                    completed_projects: stats.completed_projects || 0
                }
            });

        } catch (error) {
            console.error("Dashboard statistics error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load dashboard statistics"
            });
        }
    }
);

// =====================================
// ADMIN RECENT BOOKINGS
// =====================================

app.get(
    "/api/admin/recent-bookings",
    verifyAdmin,
    async (req, res) => {
        try {
            const [bookings] = await db.query(
                `SELECT
                    b.booking_id,
                    b.project_title,
                    b.status,
                    b.created_at,
                    c.full_name AS customer_name,
                    c.email AS customer_email,
                    s.service_name
                 FROM bookings b
                 INNER JOIN customers c
                    ON b.customer_id = c.customer_id
                 INNER JOIN services s
                    ON b.service_id = s.service_id
                 ORDER BY b.created_at DESC
                 LIMIT 10`
            );

            res.json({
                success: true,
                bookings
            });

        } catch (error) {
            console.error("Recent bookings error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load recent bookings"
            });
        }
    }
);

// =====================================
// ADMIN VIEW CUSTOMERS
// =====================================

app.get(
    "/api/admin/customers",
    verifyAdmin,
    async (req, res) => {
        try {
            const [customers] = await db.query(
                `SELECT
                    customer_id,
                    full_name,
                    email,
                    phone,
                    shop_name,
                    address
                 FROM customers
                 ORDER BY customer_id DESC`
            );

            res.json({
                success: true,
                customers
            });

        } catch (error) {
            console.error("Admin customers error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load customers"
            });
        }
    }
);

// =====================================
// ADMIN VIEW ALL BOOKINGS
// =====================================

app.get(
    "/api/admin/bookings",
    verifyAdmin,
    async (req, res) => {
        try {
            const [bookings] = await db.query(
                `SELECT
                    b.*,
                    c.full_name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    s.service_name
                 FROM bookings b
                 INNER JOIN customers c
                    ON b.customer_id = c.customer_id
                 INNER JOIN services s
                    ON b.service_id = s.service_id
                 ORDER BY b.created_at DESC`
            );

            res.json({
                success: true,
                bookings
            });

        } catch (error) {
            console.error("Admin bookings error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load booking requests"
            });
        }
    }
);

// =====================================
// ADMIN UPDATE BOOKING STATUS
// =====================================

app.patch(
    "/api/admin/bookings/:bookingId/status",
    verifyAdmin,
    async (req, res) => {
        try {
            const bookingId = Number(req.params.bookingId);
            const { status, admin_notes } = req.body;

            const allowedStatuses = [
                "pending",
                "accepted",
                "rejected",
                "in_progress",
                "completed"
            ];

            if (!Number.isInteger(bookingId) || bookingId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID"
                });
            }

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking status"
                });
            }

            const [existing] = await db.query(
                "SELECT booking_id FROM bookings WHERE booking_id = ?",
                [bookingId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            await db.query(
                `UPDATE bookings
                 SET status = ?, admin_notes = ?
                 WHERE booking_id = ?`,
                [status, admin_notes || null, bookingId]
            );

            res.json({
                success: true,
                message: "Booking status updated successfully",
                booking_id: bookingId,
                status
            });

        } catch (error) {
            console.error("Update booking error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update booking status"
            });
        }
    }
);

// =====================================
// ADMIN ADD PROJECT PROGRESS
// =====================================

app.post(
    "/api/admin/project-updates",
    verifyAdmin,
    async (req, res) => {
        let connection;

        try {
            const {
                booking_id,
                stage_name,
                progress_percentage,
                update_description
            } = req.body;

            const bookingId = Number(booking_id);
            const percentage = Number(progress_percentage);

            const stageName = typeof stage_name === "string"
                ? stage_name.trim()
                : "";

            const description = typeof update_description === "string"
                ? update_description.trim()
                : "";

            const adminId = Number(req.admin.admin_id);

            if (
                !Number.isInteger(bookingId) ||
                bookingId <= 0 ||
                !stageName ||
                progress_percentage === undefined ||
                progress_percentage === null ||
                !Number.isInteger(percentage) ||
                percentage < 0 ||
                percentage > 100 ||
                !description ||
                !Number.isInteger(adminId) ||
                adminId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please provide valid booking, stage, percentage and description"
                });
            }

            const [bookings] = await db.query(
                `SELECT booking_id, status
                 FROM bookings
                 WHERE booking_id = ?`,
                [bookingId]
            );

            if (bookings.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found"
                });
            }

            if (
                bookings[0].status === "pending" ||
                bookings[0].status === "rejected"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Progress can only be added to accepted projects"
                });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO project_updates
                (
                    booking_id,
                    stage_name,
                    progress_percentage,
                    update_description,
                    updated_by
                )
                VALUES (?, ?, ?, ?, ?)`,
                [
                    bookingId,
                    stageName,
                    percentage,
                    description,
                    adminId
                ]
            );

            let newStatus = bookings[0].status;

            if (percentage === 100) {
                newStatus = "completed";
            } else if (newStatus === "accepted") {
                newStatus = "in_progress";
            }

            await connection.query(
                "UPDATE bookings SET status = ? WHERE booking_id = ?",
                [newStatus, bookingId]
            );

            await connection.commit();

            return res.status(201).json({
                success: true,
                message: "Project progress added successfully",
                update_id: result.insertId,
                booking_id: bookingId,
                stage_name: stageName,
                progress_percentage: percentage,
                update_description: description,
                status: newStatus
            });

        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error(
                        "Project update rollback error:",
                        rollbackError
                    );
                }
            }

            console.error("Project update error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to add project progress",
                error: error.message
            });

        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

// =====================================
// CUSTOMER: VIEW OWN MESSAGES
// =====================================

app.get("/api/messages", verifyCustomer, async (req, res) => {
    try {
        const [messages] = await db.query(
            `SELECT
                message_id,
                customer_id,
                sender_role,
                sender_id,
                message,
                created_at
             FROM messages
             WHERE customer_id = ?
             ORDER BY created_at ASC, message_id ASC`,
            [req.customer.customer_id]
        );

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error("Customer messages error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load messages"
        });
    }
});

// =====================================
// CUSTOMER: SEND MESSAGE
// =====================================

app.post("/api/messages", verifyCustomer, async (req, res) => {
    try {
        const message = req.body.message?.trim();

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Please enter a message"
            });
        }

        if (message.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 5000 characters"
            });
        }

        const [result] = await db.query(
            `INSERT INTO messages
            (customer_id, sender_role, sender_id, message)
            VALUES (?, 'customer', ?, ?)`,
            [
                req.customer.customer_id,
                req.customer.customer_id,
                message
            ]
        );

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            message_id: result.insertId
        });

    } catch (error) {
        console.error("Send customer message error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send message"
        });
    }
});

// =====================================
// ADMIN: VIEW CUSTOMER CONVERSATIONS
// =====================================

app.get("/api/admin/messages", verifyAdmin, async (req, res) => {
    try {
        const customerId = req.query.customer_id
            ? Number(req.query.customer_id)
            : null;

        if (
            req.query.customer_id &&
            (!Number.isInteger(customerId) || customerId <= 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        let sql = `
            SELECT
                m.message_id,
                m.customer_id,
                m.sender_role,
                m.sender_id,
                m.message,
                m.created_at,
                c.full_name AS customer_name,
                c.email AS customer_email
            FROM messages m
            INNER JOIN customers c
                ON m.customer_id = c.customer_id
        `;

        const params = [];

        if (customerId) {
            sql += " WHERE m.customer_id = ?";
            params.push(customerId);
        }

        sql += " ORDER BY m.created_at ASC, m.message_id ASC";

        const [messages] = await db.query(sql, params);

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error("Admin messages error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to load customer messages"
        });
    }
});

// =====================================
// ADMIN: REPLY TO CUSTOMER
// =====================================

app.post("/api/admin/messages", verifyAdmin, async (req, res) => {
    try {
        const customerId = Number(req.body.customer_id);
        const message = req.body.message?.trim();

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0 ||
            !message
        ) {
            return res.status(400).json({
                success: false,
                message: "Customer ID and message are required"
            });
        }

        if (message.length > 5000) {
            return res.status(400).json({
                success: false,
                message: "Message cannot exceed 5000 characters"
            });
        }

        const [customers] = await db.query(
            "SELECT customer_id FROM customers WHERE customer_id = ?",
            [customerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const [result] = await db.query(
            `INSERT INTO messages
            (customer_id, sender_role, sender_id, message)
            VALUES (?, 'admin', ?, ?)`,
            [
                customerId,
                req.admin.admin_id,
                message
            ]
        );

        res.status(201).json({
            success: true,
            message: "Admin reply sent successfully",
            message_id: result.insertId
        });

    } catch (error) {
        console.error("Admin reply error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to send admin reply"
        });
    }
});

// =====================================
// FRONTEND STATIC FILES
// Keep this AFTER all API routes
// =====================================

app.use(express.static(path.join(__dirname, "../frontend")));

// =====================================
// CREATE MESSAGES TABLE AUTOMATICALLY
// =====================================

async function initializeDatabase() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS messages (
            message_id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            sender_role ENUM('customer', 'admin') NOT NULL,
            sender_id INT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_messages_customer (customer_id),
            INDEX idx_messages_created (created_at),
            CONSTRAINT fk_messages_customer
                FOREIGN KEY (customer_id)
                REFERENCES customers(customer_id)
                ON DELETE CASCADE
        )
    `);

    console.log("Messages table is ready!");
}

// =====================================
// START SERVER
// =====================================

async function startServer() {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is missing from backend/.env");
        }

        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `FlowTrack server running at http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error("Unable to start FlowTrack server:", error);
        process.exit(1);
    }
}

startServer();
