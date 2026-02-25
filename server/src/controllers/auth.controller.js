import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

export const register = asyncHandler(async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    res.status(400);
    throw new Error("All fields are required");
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    email,
    passwordHash,
    displayName,
  });

  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
  });

  res.status(201).json({
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user._id);

  res.cookie("token", token, {
    httpOnly: true,
    secure: false,
  });

  res.json({
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
    token,
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});