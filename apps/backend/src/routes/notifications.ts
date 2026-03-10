import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Simulated notification service (Twilio SMS + SendGrid Email)
interface NotificationLog {
    id: number;
    type: "sms" | "email";
    recipient: string;
    subject: string;
    body: string;
    sentAt: string;
    tenderId: number;
}

const notificationLogs: NotificationLog[] = [];
let notifCounter = 0;

export async function notificationRoutes(app: FastifyInstance) {
    // ── Send Notification (Internal) ───────────────────────────
    app.post("/send", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["type", "recipient", "subject", "body", "tenderId"],
                properties: {
                    type: { type: "string", enum: ["sms", "email"] },
                    recipient: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" },
                    tenderId: { type: "number" },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { type: "sms" | "email"; recipient: string; subject: string; body: string; tenderId: number }
    }>) => {
        const { type, recipient, subject, body, tenderId } = request.body;

        notifCounter++;
        const log: NotificationLog = {
            id: notifCounter,
            type,
            recipient,
            subject,
            body,
            sentAt: new Date().toISOString(),
            tenderId,
        };
        notificationLogs.push(log);

        // Simulated send
        console.log(`📱 [${type.toUpperCase()}] To: ${recipient} | Subject: ${subject}`);
        if (type === "sms") {
            console.log(`   → Twilio SMS simulated: ${body.substring(0, 100)}...`);
        } else {
            console.log(`   → SendGrid email simulated: ${body.substring(0, 100)}...`);
        }

        return { success: true, data: { notificationId: log.id, status: "sent_simulated" } };
    });

    // ── Get Notification History ───────────────────────────────
    app.get("/history", {
        preHandler: [(app as any).authenticate],
    }, async (request: FastifyRequest<{
        Querystring: { tenderId?: string }
    }>) => {
        const { tenderId } = request.query;
        let results = [...notificationLogs];
        if (tenderId) results = results.filter((n) => n.tenderId === parseInt(tenderId));

        return { success: true, data: results.reverse() };
    });

    // ── Schedule Deadline Alerts ───────────────────────────────
    app.post("/schedule-alerts", {
        preHandler: [(app as any).authenticate],
        schema: {
            body: {
                type: "object",
                required: ["tenderId", "submissionDeadline", "revealDeadline", "recipients"],
                properties: {
                    tenderId: { type: "number" },
                    submissionDeadline: { type: "string" },
                    revealDeadline: { type: "string" },
                    recipients: { type: "array", items: { type: "object", properties: { email: { type: "string" }, phone: { type: "string" } } } },
                },
            },
        },
    }, async (request: FastifyRequest<{
        Body: { tenderId: number; submissionDeadline: string; revealDeadline: string; recipients: any[] }
    }>) => {
        const { tenderId, submissionDeadline, revealDeadline, recipients } = request.body;

        // Scheduled alerts: 48h before, 6h before submission, reveal opens, 6h before reveal
        const schedules = [
            { offset: -48 * 3600 * 1000, message: "48 hours before submission deadline", deadline: submissionDeadline },
            { offset: -6 * 3600 * 1000, message: "6 hours before submission deadline", deadline: submissionDeadline },
            { offset: 0, message: "Reveal phase is now open", deadline: submissionDeadline },
            { offset: -6 * 3600 * 1000, message: "6 hours before reveal deadline", deadline: revealDeadline },
        ];

        console.log(`📅 Scheduled ${schedules.length} alerts for tender #${tenderId} to ${recipients.length} recipients`);

        return {
            success: true,
            data: {
                tenderId,
                alertsScheduled: schedules.length,
                recipientCount: recipients.length,
                status: "scheduled_simulated",
            },
        };
    });
}
