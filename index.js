const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

// CRUD sample endpoint
app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

app.post('/query', async (req, res) => {
  //logic for query, so secure
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
