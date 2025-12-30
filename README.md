# BE-SENTRIA

## Project Overview

Sentria is a community-driven disaster response platform that helps people stay safe and connected during natural disasters. Users can report incidents with map-based locations, share real-time updates, and request or offer help to others nearby. The platform intelligently aggregates post data to identify affected zones and generate safe travel routes that avoid danger areas. It also provides access to vital resources such as emergency hotlines, shelter locations, and survival guides—all powered by free and open-source technologies.

## Motivation

On March 28, 2025, a major earthquake struck my hometown, Mandalay. I was not there, but my parents were. For several days, I could not reach them. Our home was completely destroyed, and the surrounding community was left without reliable communication or trustworthy information.

That experience shaped the core idea behind Sentria.

Disasters often damage infrastructure unevenly. Entire cities may lose connectivity, yet a small number of people can still access the internet. Sentria is designed around this reality: as long as someone can connect, information should be able to move. The platform enables connected users to share structured updates, request or offer help, and spread verified information outward to disconnected communities through any available channels.

Rather than assuming stable networks or centralized authorities, Sentria focuses on maintaining usefulness under degraded conditions. It treats information as a signal that must be structured, verified, and resilient enough to survive partial outages.

From an engineering perspective, the project explores how to design systems that:

- Operate under uncertainty and incomplete connectivity
- Separate real-time user interaction from background verification
- Aggregate community input into more trustworthy signals
- Remain valuable even when infrastructure is unreliable

Sentria is an engineering-driven project motivated by a simple goal: to reduce isolation and confusion during crises by ensuring that reliable information can exist and propagate, even when systems are under stress.

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

## Contributors

- [Sebastian Kein (AungKyaw Phyo)](https://github.com/AungKyawPhyo1142)
- [Nyi Nyi Soe](https://github.com/Nyi-NyiSoe)
- [Kyi Thant Sin](https://github.com/KyiThantSin)
- [Linn Latt Cho](https://github.com/linnlatt132)
- [Saw Zi Dunn](https://github.com/SawZiDunn)
- [Phyu Thant Kyaw](https://github.com/My1ra)
