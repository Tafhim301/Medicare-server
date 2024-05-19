const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51P3B8UK9W3t9P5U1yhkPKrOSRFjwnoGlj4MpGhwhFsr6aepQddXA2XjKzyQADjfxJ1FKuaCdrFbF330zLwjjY7wN00IyauA5ud');

// Middlewares
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gsjmw27.mongodb.net`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    const userCollection = client.db("medicareDb").collection("user");
    const bannerCollection = client.db("medicareDb").collection("banners");
    const testCollection = client.db("medicareDb").collection("tests");
    const reservationCollection = client.db("medicareDb").collection("reservations");
    // Token and admin related middlewares
    const verifyToken = async (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" })
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {


          return res.status(401).send({ message: "unauthorized access" });


        }
        req.decoded = decoded;
        next();
      })

    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }
    // Token Related API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
      res.send({ token });

    })

    // User related API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.get('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    })
    app.put('/user/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const query = { _id: new ObjectId(id) };
  
      const updateDoc = {
          $set: {
              name: updatedUser.name,
              email: updatedUser.email,
              avatar: updatedUser.avatar,
              blood_group: updatedUser.blood_group,
              district: updatedUser.district,
              upazilla: updatedUser.upazilla,
          }
      };
  
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
  })  

    app.get('/user/info/:email',verifyToken,async(req,res)=>{
      const email = req.params.email;
      const query = {email: email};
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    app.post('/user', async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.patch('/users/admin/:id', verifyAdmin, verifyAdmin, async (req, res) => {

      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }

      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);

    })
    app.patch('/users/status/:id', verifyToken, verifyAdmin, async (req, res) => {

      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const user = await userCollection.findOne(filter);

      const updatedDoc = {
        $set: {
          isActive: !user.isActive
        }

      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);

    })

    app.get('/user/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }

      res.send(admin);


    })

    // Bannner related API
    app.get('/banners',  async (req, res) => {
      const result = await bannerCollection.find().toArray();
      res.send(result);
    })

    app.get('/banner', async (req, res) => {
      const query = { isActive: true };
      const result = await bannerCollection.findOne(query);
      res.send(result)
    })

    app.post('/banner', verifyToken, verifyAdmin, async (req, res) => {
      const banner = req.body;
      const result = await bannerCollection.insertOne(banner);
      res.send(result);
    })

    app.put('/banner/status/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      await bannerCollection.updateMany({}, { $set: { isActive: false } })
      const updatedDoc = {
        $set: {
          isActive: true
        }
      }
      const result = await bannerCollection.updateOne(query, updatedDoc);
      res.send(result);
    })
    // Test related API
    app.get('/allTests', async (req, res) => {
      const result = await testCollection.find().toArray();
      res.send(result);
    })

    app.get('/test/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const result = await testCollection.findOne(query);
      res.send(result);
    })
    app.post('/addTest', verifyToken, verifyAdmin, async (req, res) => {
      const test = req.body;
      const result = await testCollection.insertOne(test);
      res.send(result)
    })

    app.put('/updateTest/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const test = req.body;
      const updatedDoc = {
        $set: {
          name: test?.name,
          image: test?.image,
          details: test?.details,
          price: test?.price,
          slots: test?.slots,
          date: test?.date,

        }
      }
      const result = await testCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.delete('/test/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await testCollection.deleteOne(query);
      res.send(result);
    })

    // Booking Related API

    app.post('/booking/:id',verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const reservation = req.body;
     
      const updatedDoc ={
       
      
          $inc:{
           slots : -1,
           reservations: 1
          }

        }
      
    await testCollection.updateOne(query,updatedDoc);
    const result = await reservationCollection.insertOne(reservation);
    res.send(result);
      

    })


    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecet: paymentIntent.client_secret

      })

    })

    // reservations related API
    app.get('/reservations',verifyToken,verifyAdmin,async(req,res)=>{
      const result = await reservationCollection.find().toArray();
      res.send(result);
    })

    app.get('/appointments/:email',verifyToken,async(req,res) =>{
      const email = req.params.email;
      const query = { email : email}
      const result = await reservationCollection.find(query).toArray();
      res.send(result);
    })




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB Atlas:", error);
  }
}

run().catch(console.error);

app.get('/', (req, res) => {
  res.send('Doctors are taking care of patients');
});

app.listen(port, () => {
  console.log(`Doctors are healing people on port: ${port}`);
});
