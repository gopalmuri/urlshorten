import { createServer } from "http";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const PORT = process.env.PORT || 3002;

const DATA_DIR = path.join("data");
const DATA_FILE = path.join(DATA_DIR, "links.json");

// Load links from file
const loadLinks = async () => {
  try {
    const data = await readFile(DATA_FILE, "utf-8");
    return data.trim() === "" ? {} : JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DATA_FILE, JSON.stringify({}));
      return {};
    }
    throw error;
  }
};

// Save links to file
const saveLinks = async (links) => {
  await writeFile(DATA_FILE, JSON.stringify(links, null, 2));
};

// HTTP server
const server = createServer(async (req, res) => {
  console.log(`Request URL: ${req.url}, Method: ${req.method}`);

  // Serve static files
  if (req.method === "GET") {
    if (req.url === "/") {
      try {
        const data = await readFile(path.join("index.html"));
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end(data);
      } catch (error) {
        console.error("Error reading index.html:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("500 Internal Server Error");
      }
    } else if (req.url === "/style.css") {
      try {
        const data = await readFile(path.join("style.css"));
        res.writeHead(200, { "Content-Type": "text/css" });
        return res.end(data);
      } catch (error) {
        console.error("Error reading style.css:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("500 Internal Server Error");
      }
    }

    // ✅ Redirect if shortCode exists
    const shortCode = req.url.slice(1); // remove leading "/"
    const links = await loadLinks();
    if (links[shortCode]) {
      res.writeHead(302, { Location: links[shortCode] });
      return res.end();
    }

    // If none matched
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404 Not Found");
  }

  // Handle POST /shorten
  if (req.method === "POST" && req.url === "/shorten") {
    const links = await loadLinks();
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const { url, shortCode } = JSON.parse(body);

        if (!url) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("URL is required");
        }

        const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

        if (links[finalShortCode]) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short code already exists. Try another.");
        }

        links[finalShortCode] = url;
        await saveLinks(links);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, shortUrl: `http://:${PORT}/${finalShortCode}` }));
      } catch (err) {
        console.error("POST /shorten failed:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Internal Server Error");
      }
    });

    return;
  }

  // Method not allowed
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.end("405 Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
