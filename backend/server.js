import "dotenv/config.js";
import express from "express";
import cors from "cors";
import aiRoute from "./routes/ai.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/ask-ai", aiRoute);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
