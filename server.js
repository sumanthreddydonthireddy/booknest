require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');

// DB connection
require('./db/config');

// Models
const Admin       = require('./db/Admin/Admin');
const Users       = require('./db/Users/userschema');
const Seller      = require('./db/Seller/Sellers');
const Items       = require('./db/Seller/Additem');
const MyOrders    = require('./db/Users/myorders');
const WishlistItem = require('./db/Users/Wishlist');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Multer — disk storage, normalised path separators
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
  },
});
const upload = multer({ storage });

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => res.json({ message: 'BookStore API running on port ' + PORT }));

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// POST /alogin
app.post('/alogin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ Status: 'error', message: 'Email and password required' });
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.json({ Status: 'no user' });
    // FIX: plain-text compare (schema stores plain text — swap to bcrypt when ready)
    if (admin.password !== password) return res.json({ Status: 'login fail' });
    res.json({ Status: 'Success', user: { id: admin._id, name: admin.name, email: admin.email } });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// POST /asignup
app.post('/asignup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ Status: 'error', message: 'All fields required' });
  try {
    const existing = await Admin.findOne({ email });
    if (existing) return res.json({ Status: 'exists' });
    await Admin.create({ name, email, password });
    res.json({ Status: 'created' });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// GET /users — all users (admin)
app.get('/users', async (req, res) => {
  try {
    res.json(await Users.find().select('-password'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /userdelete/:id
app.delete('/userdelete/:id', async (req, res) => {
  try {
    await Users.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /userorderdelete/:id
app.delete('/userorderdelete/:id', async (req, res) => {
  try {
    await MyOrders.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /useritemdelete/:id
app.delete('/useritemdelete/:id', async (req, res) => {
  try {
    await Items.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /sellers — all sellers (admin)
app.get('/sellers', async (req, res) => {
  try {
    res.json(await Seller.find().select('-password'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /sellerdelete/:id
app.delete('/sellerdelete/:id', async (req, res) => {
  try {
    await Seller.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /orders — all orders (admin)
app.get('/orders', async (req, res) => {
  try {
    res.json(await MyOrders.find().sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SELLER ────────────────────────────────────────────────────────────────────

// POST /slogin
app.post('/slogin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ Status: 'error', message: 'Email and password required' });
  try {
    const user = await Seller.findOne({ email });
    if (!user) return res.json({ Status: 'no user' });
    if (user.password !== password) return res.json({ Status: 'login fail' });
    res.json({ Status: 'Success', user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// POST /ssignup
app.post('/ssignup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ Status: 'error', message: 'All fields required' });
  try {
    const existing = await Seller.findOne({ email });
    if (existing) return res.json({ Status: 'exists' });
    await Seller.create({ name, email, password });
    res.json({ Status: 'created' });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// POST /items — add book with image upload
// FIX: guard against missing file; normalise Windows backslashes in path
app.post('/items', upload.single('itemImage'), async (req, res) => {
  const { title, author, genre, description, price, userId, userName } = req.body;
  if (!req.file)
    return res.status(400).json({ error: 'Image file is required' });
  if (!title || !author || !genre || !price)
    return res.status(400).json({ error: 'Title, author, genre and price are required' });

  const itemImage = req.file.path.replace(/\\/g, '/'); // normalise Windows slashes
  try {
    const item = new Items({ itemImage, title, author, genre, description, price, userId, userName });
    await item.save();
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /getitem/:userId — seller's own books
app.get('/getitem/:userId', async (req, res) => {
  try {
    const result = await Items.find({ userId: req.params.userId });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /itemdelete/:id
app.delete('/itemdelete/:id', async (req, res) => {
  try {
    await Items.findByIdAndDelete(req.params.id);
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /getsellerorders/:userId — orders for a seller's books
app.get('/getsellerorders/:userId', async (req, res) => {
  try {
    const result = await MyOrders.find({ sellerId: req.params.userId }).sort({ createdAt: -1 });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── USER ──────────────────────────────────────────────────────────────────────

// POST /login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ Status: 'error', message: 'Email and password required' });
  try {
    const user = await Users.findOne({ email });
    if (!user) return res.json({ Status: 'User not found' });
    if (user.password !== password) return res.json({ Status: 'Invalid Password' });
    res.json({ Status: 'Success', user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// POST /signup
app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ Status: 'error', message: 'All fields required' });
  try {
    const existing = await Users.findOne({ email });
    if (existing) return res.json({ Status: 'exists' });
    await Users.create({ name, email, password });
    res.json({ Status: 'created' });
  } catch (e) {
    res.status(500).json({ Status: 'error', message: e.message });
  }
});

// GET /item — all books
app.get('/item', async (req, res) => {
  try {
    const { search, genre } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { title:  { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
      ];
    }
    if (genre) filter.genre = { $regex: genre, $options: 'i' };
    res.json(await Items.find(filter).sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /item/:id — single book
app.get('/item/:id', async (req, res) => {
  try {
    const item = await Items.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /userorder — place order
app.post('/userorder', async (req, res) => {
  const {
    flatno, city, state, pincode,
    totalamount, seller, sellerId,
    BookingDate, description, Delivery,
    userId, userName,
    booktitle, bookauthor, bookgenre, itemImage,
  } = req.body;

  if (!flatno || !city || !state || !pincode)
    return res.status(400).json({ error: 'Complete shipping address required' });
  if (!booktitle || !totalamount)
    return res.status(400).json({ error: 'Book title and amount required' });

  try {
    const order = new MyOrders({
      flatno, city, state, pincode,
      totalamount, seller, sellerId,
      BookingDate, description, Delivery,
      userId, userName,
      booktitle, bookauthor, bookgenre, itemImage,
    });
    await order.save();
    res.status(201).json(order);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /getorders/:userId — user's orders
app.get('/getorders/:userId', async (req, res) => {
  try {
    const result = await MyOrders.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── WISHLIST ──────────────────────────────────────────────────────────────────

// GET /wishlist/:userId
app.get('/wishlist/:userId', async (req, res) => {
  try {
    res.json(await WishlistItem.find({ userId: req.params.userId }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /wishlist/add
app.post('/wishlist/add', async (req, res) => {
  const { itemId, title, itemImage, userId, userName } = req.body;
  if (!itemId || !userId)
    return res.status(400).json({ error: 'itemId and userId required' });
  try {
    const existing = await WishlistItem.findOne({ itemId, userId });
    if (existing) return res.status(400).json({ msg: 'Item already in wishlist' });
    const newItem = new WishlistItem({ itemId, title, itemImage, userId, userName });
    await newItem.save();
    res.json(newItem);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /wishlist/remove
// FIX: filter by BOTH itemId AND userId to prevent cross-user deletion
app.post('/wishlist/remove', async (req, res) => {
  const { itemId, userId } = req.body;
  if (!itemId || !userId)
    return res.status(400).json({ error: 'itemId and userId required' });
  try {
    await WishlistItem.findOneAndDelete({ itemId, userId });
    res.json({ msg: 'Removed from wishlist' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 404 + Global error handler ────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`✅ BookStore server running on http://localhost:${PORT}`));
