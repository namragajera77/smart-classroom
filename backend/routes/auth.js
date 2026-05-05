/**
 * Authentication Routes
 * Handles user registration and login
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (teacher or student)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, teacherId, teacherIds } = req.body;

    // Validation
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide all required fields' 
      });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid role. Must be teacher or student' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    let assignedTeacherId = null;
    let assignedTeacherIds = [];
    if (role === 'student') {
      const normalizedTeacherIds = [
        ...(Array.isArray(teacherIds) ? teacherIds : []),
        ...(teacherId ? [teacherId] : [])
      ].filter(Boolean);

      const uniqueTeacherIds = [...new Set(normalizedTeacherIds.map((id) => String(id)))];

      if (!uniqueTeacherIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Please select at least one teacher'
        });
      }

      const selectedTeachers = await User.find({
        _id: { $in: uniqueTeacherIds },
        role: 'teacher'
      }).select('_id');

      if (selectedTeachers.length !== uniqueTeacherIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected teachers not found'
        });
      }

      assignedTeacherIds = selectedTeachers.map((t) => t._id);
      assignedTeacherId = assignedTeacherIds[0] || null;
    }

    // Create new user
    const user = new User({ name, email, password, role, assignedTeacherId, assignedTeacherIds });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedTeacherId: user.assignedTeacherId,
        assignedTeacherIds: user.assignedTeacherIds
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedTeacherId: user.assignedTeacherId,
        assignedTeacherIds: user.assignedTeacherIds
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedTeacherId: user.assignedTeacherId,
        assignedTeacherIds: user.assignedTeacherIds
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedTeacherId: user.assignedTeacherId,
        assignedTeacherIds: user.assignedTeacherIds
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

/**
 * @route   GET /api/auth/teachers
 * @desc    Get available teachers for student registration
 * @access  Public
 */
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await User.find({ role: 'teacher' })
      .select('_id name email')
      .sort({ name: 1, createdAt: -1 });

    res.json({
      success: true,
      teachers
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teachers'
    });
  }
});

module.exports = router;
