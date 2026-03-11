import { NextResponse } from "next/server";
import os from "os";
import { execSync } from "child_process";

export async function GET() {
    try {
        // CPU Load (1 min average)
        const cpuLoad = os.loadavg()[0].toFixed(2);

        // Memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercentage = ((usedMem / totalMem) * 100).toFixed(1);

        // Disk usage (using shell for simplicity on Linux/Mac)
        let diskUsage = "0";
        try {
            const dfResult = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim();
            diskUsage = dfResult.replace("%", "");
        } catch (err) {
            console.error("Failed to fetch disk usage", err);
        }

        // Latency (simplified: time taken to process this request)
        // In a real app, you might ping a public DNS or the stream server
        const stats = {
            cpu: `${cpuLoad}%`,
            memory: `${memPercentage}%`,
            storage: `${diskUsage}%`,
            latency: "24ms", // Placeholder for now
            uptime: Math.floor(os.uptime() / 3600) + "h"
        };

        return NextResponse.json(stats);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
