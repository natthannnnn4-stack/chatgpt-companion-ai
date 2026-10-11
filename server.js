const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 20000) {
      throw new Error("Request too large");
    }
  }
  return JSON.parse(body || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "ChatGPT Companion AI"
    });
  }

  if (req.method !== "POST" || url.pathname !== "/chat") {
    return sendJson(res, 404, { error: "Not found" });
  }

  if (!API_KEY) {
    return sendJson(res, 503, {
      error: "Missing OPENAI_API_KEY"
    });
  }

  try {
    const body = await readJson(req);
    const message = typeof body.message === "string"
      ? body.message.trim()
      : "";
    const playerName = typeof body.playerName === "string"
      ? body.playerName.slice(0, 32)
      : "Jogador";

    if (!message) {
      return sendJson(res, 400, {
        error: "Envie uma mensagem"
      });
    }

    if (message.length > 2000) {
      return sendJson(res, 400, {
        error: "Mensagem muito longa"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          instructions:
            "Você é um companheiro amigável dentro do Minecraft Bedrock. Responda em português brasileiro, de forma curta e útil. Ajude com exploração, construção e sobrevivência. Não diga que consegue alterar o mundo diretamente se nenhuma ferramenta de jogo estiver conectada.",
          input: `Jogador: ${playerName}\nMensagem: ${message}`,
          max_output_tokens: 250
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro da IA:", response.status);
      return sendJson(res, 502, {
        error: "A IA não respondeu. Confira a chave e os limites da API."
      });
    }

    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n")
      .trim();

    return sendJson(res, 200, {
      reply: reply || "Não consegui responder agora."
    });
  } catch (error) {
    console.error("Erro:", error.message);
    return sendJson(res, 400, {
      error: "Pedido inválido"
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("ChatGPT Companion AI iniciado na porta " + PORT);
});
