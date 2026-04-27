import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "user", content: "قل مرحبا بالعربي" },
    ],
  });

  console.log("RESPONSE:");
  console.log(res.choices[0].message.content);
}

test();