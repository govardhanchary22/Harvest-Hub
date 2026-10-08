# Harvest Hub — Farmer Marketplace

A MERN marketplace connecting local farmers with customers. Farmers can publish and manage produce listings; customers can browse, search, and filter what's available.

## Features

- Register and sign in as a farmer or customer.
- Separate role-specific pages: customers browse the marketplace at `/customer`, and farmers manage their farm stand at `/farmer`.
- Browse, search, and filter produce by category and location.
- Farmer-only listing creation, editing, and deletion. Farmers can manage only their own listings.
- Customers pay farmers directly by scanning a locally generated UPI QR code; no payment gateway credentials are required.
- Customers can report a payment and optionally provide its UPI transaction reference. Farmers verify payments in their UPI app and confirm or reject them.
- Customer orders appear in the farmer dashboard; listing quantity is reduced when a farmer confirms an order.
- MongoDB persistence for users and product listings.
- JWT-based API authentication.

## Requirements

- Node.js 20 or newer
- MongoDB 6 or newer (local instance or MongoDB Atlas)

## Run locally

1. Install dependencies from the project root:

   ```sh
   npm install
   ```

2. Create `server/.env` from `server/.env.example` and set `MONGODB_URI` and a long, random `JWT_SECRET`. Farmers add their UPI ID in the farmer dashboard before customers can place orders.

3. Start both the API and frontend:

   ```sh
   npm run dev
   ```

   The React app is at `http://localhost:5173`; the API is at `http://localhost:5000`.

4. Register an account, choosing **Farmer** to open the farm dashboard or **Customer** to open the marketplace. Their role-specific page is restored automatically on the next visit.

## Publish on Render

The included `render.yaml` deploys the API and built React app as one web service. Before deploying:

1. Push this project to a GitHub repository and create a MongoDB Atlas database. Add a database user and allow network access from Render (Atlas `0.0.0.0/0` is commonly needed for Render services without fixed outbound IPs; use a strong, unique database password).
2. In Render, create a **Blueprint** from the GitHub repository and apply `render.yaml`.
3. When prompted, set `MONGODB_URI` to the Atlas connection string, including the database name `harvest-hub`. Render generates `JWT_SECRET`.
4. Wait for the service health check at `/api/health` to pass, then open the public `onrender.com` URL. React routes such as `/customer` and `/farmer` are served by the same app.

Do not commit database credentials or `.env` files. Farmer accounts must configure a UPI ID after signup before customers can place orders.

## API overview

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a farmer or customer account |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Signed in | Get the current account |
| PUT | `/api/auth/farmer-payment` | Farmer | Save the farmer's UPI ID |
| GET | `/api/products` | Public | List and filter products (`search`, `category`, `location`) |
| GET | `/api/products/mine` | Farmer | List the signed-in farmer's products |
| GET | `/api/products/:id` | Public | Get one product |
| POST | `/api/products` | Farmer | Create a product |
| PATCH | `/api/products/:id` | Listing owner | Update a product |
| DELETE | `/api/products/:id` | Listing owner | Delete a product |
| POST | `/api/orders` | Customer | Create an order and get the farmer's UPI payment details |
| POST | `/api/orders/:id/payment-submitted` | Customer | Report a UPI payment, optionally with its transaction reference |
| POST | `/api/orders/:id/cancel` | Customer | Cancel an order before payment confirmation |
| GET | `/api/orders/farmer` | Farmer | View customer orders and payment notifications |
| PATCH | `/api/orders/:id/status` | Order's farmer | Confirm or reject a reported payment |
| PATCH | `/api/orders/:id/read` | Order's farmer | Mark a customer order notification as read |

UPI payments are made outside the marketplace. The app does not independently verify that money was transferred; farmers must check their UPI app before confirming an order.

## Project structure

```text
client/     React + Vite user interface
server/     Express API, Mongoose models, and authentication
```
