# SmartLog Tools

A monitoring dashboard for dental clinic X-ray activity using AWS CloudWatch logs.

## Overview

SmartLog Tools provides a dashboard to monitor dental clinic X-ray activity in real-time, using data from AWS CloudWatch logs. The system:

- Connects to AWS CloudWatch to fetch real X-ray treatment data
- Displays clinic activity status and alerts for inactive clinics
- Provides detailed X-ray monitoring with timestamps
- Supports notifications via Slack for clinics with no activity

## Features

- Real-time clinic monitoring dashboard
- X-ray activity tracking by clinic
- Business hours detection
- Detailed X-ray data visualization
- AWS CloudWatch log integration

## Setup

### Prerequisites

- Node.js v16+ 
- AWS CLI installed and configured with access to CloudWatch logs
- AWS SSO login credentials

### Installation

1. Install dependencies for the client:

```bash
npm install
```

2. Install dependencies for the server:

```bash
cd server
npm install
```

### Configuration

1. Configure AWS CLI with your credentials:

```bash
aws configure
# OR for SSO login:
aws sso login --profile prod
```

2. Start the server:

```bash
cd server
npm run dev
```

3. Start the client:

```bash
npm start
```

## Usage

1. Open the application in your browser (usually http://localhost:3000)
2. Connect to AWS using the "Connect to AWS" button
3. Add clinics to monitor using their location IDs
4. View real-time X-ray activity and clinic status

## Real Data Integration

The system has been updated to use real AWS CloudWatch logs instead of simulated data. Key components:

- `server/api/aws-logs.js`: Handles CloudWatch log queries for real X-ray data
- `loadTreatmentData` function in `ClinicMonitoringDashboard.tsx`: Fetches and processes real data
- Business hours detection for accurate clinic status monitoring

## Troubleshooting

- If no X-ray data appears, ensure you're properly connected to AWS
- Check AWS credentials with `aws sts get-caller-identity --profile prod`
- Verify the log group exists in AWS CloudWatch
- Check server logs for any API errors 