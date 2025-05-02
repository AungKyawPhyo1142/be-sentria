# BE-SENTRIA
## Project Overview

Sentria is a community-driven disaster response platform that helps people stay safe and connected during natural disasters. Users can report incidents with map-based locations, share real-time updates, and request or offer help to others nearby. The platform intelligently aggregates post data to identify affected zones and generate safe travel routes that avoid danger areas. It also provides access to vital resources such as emergency hotlines, shelter locations, and survival guides—all powered by free and open-source technologies.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

- [Node.js](https://nodejs.org/) (version 20 or later)
- [pnpm](https://pnpm.io/) (version 9 or later)
- [PostgreSQL](https://www.postgresql.org/) (for local database setup)

## Development Setup

1. **Clone the repository**:

   ```bash
   git clone https://github.com/AungKyawPhyo1142/be-sentria.git
   cd be-sentria
   ```

2. **Set up environment variables**:

   - Copy the `.env.example` file to `.env`.
   - Update only the `DATABASE_URL` in your `.env` file with your local PostgreSQL connection string.

3. **Install pnpm**:
   If you don’t have pnpm installed, use the following command to install it globally:

   ```bash
   npm install -g pnpm
   ```

4. **Run the initialization command**:
   Run the following command to install dependencies, run Prisma commands, and start the development server:
   ```bash
   pnpm dev
   ```
