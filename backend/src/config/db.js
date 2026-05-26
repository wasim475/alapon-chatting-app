import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.9j1qg0y.mongodb.net/?appName=Cluster0`

  if (!uri) {
    throw new Error("MONGO_URI is missing from environment variables"); 
  }

  mongoose.set("strictQuery", true);

  const connection = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${connection.connection.host}`);
};
