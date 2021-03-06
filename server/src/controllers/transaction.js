const { users, transactions, products, profile } = require("../../models");
const midtransClient = require("midtrans-client");
const nodemailer = require("nodemailer");

exports.getAllTransactions = async (req, res) => {

  try {
    const idBuyer = req.user.id;
    let data = await transactions.findAll({
      where: {
        idBuyer,
      },
      order: [["createdAt", "DESC"]],
      attributes: {
        exclude: ["updatedAt", "idBuyer", "idSeller", "idProduct"],
      },
      include: [
        {
          model: products,
          as: "products",
          attributes: {
            exclude: [
              "createdAt",
              "updatedAt",
              "idUser",
              "qty",
              "price",
              "desc",
            ],
          },
        },
        {
          model: users,
          as: "buyer",
          attributes: {
            exclude: ["createdAt", "updatedAt", "password", "status"],
          },
        },
        {
          model: users,
          as: "seller",
          attributes: {
            exclude: ["createdAt", "updatedAt", "password", "status"],
          },
        },
      ],
    });

    data = JSON.parse(JSON.stringify(data));

    data = data.map((item) => {
      return {
        ...item,
        products: {
          ...item.products,
          image: process.env.PATH_FILE + item.products.image,
        },
      };
    });

    res.send({
      status: "success",
      data,
    });
  } catch (error) {
    console.log(error);
    res.send({
      status: "failed",
      message: "Server Error",
    });
  }
};

exports.addTransaction = async (req, res) => {
  
  try {
    let data = req.body;
    data = {
      id: parseInt(data.idProduct + Math.random().toString().slice(3, 8)),
      ...data,
      idBuyer: req.user.id,
      status: "pending",
    };

    const newData = await transactions.create(data);
    const buyerData = await users.findOne({
      include: {
        model: profile,
        as: "profile",
        attributes: {
          exclude: ["createdAt", "updatedAt", "idUser"],
        },
      },
      where: {
        id: newData.idBuyer,
      },
      attributes: {
        exclude: ["createdAt", "updatedAt", "password"],
      },
    });

    let snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });

    let parameter = {
      transaction_details: {
        order_id: newData.id,
        gross_amount: newData.price,
      },
      credit_card: {
        secure: true,
      },
      customer_details: {
        full_name: buyerData?.name,
        email: buyerData?.email,
        phone: buyerData?.profile?.phone,
      },
    };

    const payment = await snap.createTransaction(parameter);

    res.send({
      status: "pending",
      message: "Pending transaction payment gateway",
      payment,
      product: {
        id: data.idProduct,
      },
    });
  } catch (error) {
    console.log(error);
    res.send({
      status: "failed",
      message: "Server Error",
    });
  }
};

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY

const core = new midtransClient.CoreApi();
core.apiConfig.set({
  isProduction: false,
  serverKey: MIDTRANS_SERVER_KEY,
  clientKey: MIDTRANS_CLIENT_KEY
})

/**
 *  Handle update transaction status after notification
 * from midtrans webhook
 * @param {string} status
 * @param {transactionId} transactionId
 */

exports.notification = async (req,res) => {

  try {
    const statusResponse = await core.transaction.notification(req.body)
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status
    const fraudStatus = statusResponse.fraud_status

    if (transactionStatus == "capture") {
      if (fraudStatus == "challenge") {
        sendEmail("pending", orderId);
        updateTransaction("pending", orderId);
        res.status(200);

      } else if (fraudStatus == "accept") {
        sendEmail("success", orderId);
        updateProduct(orderId);
        updateTransaction("success", orderId);
        res.status(200);
      }
    } else if (transactionStatus == "settlement") {
      sendEmail("success", orderId);
      updateTransaction("success", orderId);
      res.status(200);
    } else if (
      transactionStatus == "cancel" ||
      transactionStatus == "deny" ||
      transactionStatus == "expire"
    ) {
      sendEmail("failed", orderId);
      updateTransaction("failed", orderId);
      res.status(200);
    } else if (transactionStatus == "pending") {
      sendEmail("pending", orderId);
      updateTransaction("pending", orderId);
      res.status(200);
    }
    
  } catch (error) {
    console.log(error)
    res.send({
      message: 'Server Error'
    })
  }
}

const updateTransaction = async (status, transactionId) => {
  await transactions.update(
    {
      status,
    },
    {
      where: {
        id: transactionId,
      },
    }
  );
}; 

const updateProduct = async (orderId) => {
  const transactionData = await transactions.findOne({
    where: {
      id: orderId,
    },
  });

  const productData = await products.findOne({
    where: {
      id: transactionData.idProduct,
    },
  });
  
  const qty = productData.qty - 1;
  await products.update({ qty }, { where: { id: productData.id } });
};

const sendEmail = async (status, transactionId) => {

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SYSTEM_EMAIL,
      pass: process.env.SYSTEM_PASSWORD,
    },
  });

  let data = await transactions.findOne({
    where: {
      id: transactionId,
    },
    attributes: {
      exclude: ["createdAt", "updatedAt", "password"],
    },
    include: [
      {
        model: users,
        as: "buyer",
        attributes: {
          exclude: ["createdAt", "updatedAt", "password", "status"],
        },
      },
      {
        model: products,
        as: "products",
        attributes: {
          exclude: [
            "createdAt",
            "updatedAt",
            "idUser",
            "qty",
            "price",
            "desc",
          ],
        },
      },
    ],
  });

  data = JSON.parse(JSON.stringify(data));

  const mailOptions = {
    from: process.env.SYSTEM_EMAIL,
    to: data.buyer.email,
    subject: "Payment status",
    text: "Your payment is <br />" + status,
    html: `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Document</title>
                <style>
                  h1 {
                    color: brown;
                  }
                </style>
              </head>
              <body>
                <h2>Product payment :</h2>
                <ul style="list-style-type:none;">
                  <li>Name : ${data.products.name}</li>
                  <li>Total payment: ${data.price}</li>
                  <li>Status : <b>${status}</b></li>
                </ul>  
              </body>
            </html>`,
  };

  if (data.status != status) {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) throw err;
      console.log("Email sent: " + info.response);

      return res.send({
        status: "Success",
        message: info.response,
      });
    });
  }
};