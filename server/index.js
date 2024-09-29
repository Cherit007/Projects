const express = require("express");
const app = express();
const mailer = require("nodemailer");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

app.use(bodyParser.json());
app.use(cors());
// app.use(express.static(path.join(__dirname, "./build")));
app.listen(3001, () => {
  console.log("server started");
});
app.use(
  cors({
    origin: "*", 
  })
);
app.post("/submit-form", (req, res) => {
  const formData = req.body;
  const toEmail = formData?.email;
  const toName = formData?.name;
  const message = formData?.message;
  const phoneNo = formData?.phoneNo;
  const transport = mailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "cheritcherry@gmail.com",
      pass: "vtre vvbi ffwb hpwb",
    },
  });
  const template = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Inquiry</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 20px;
          }
          .email-container {
              background-color: #ffffff;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
              max-width: 600px;
              margin: auto;
          }
          .email-header {
              text-align: center;
              background-color: #007BFF;
              color: #ffffff;
              padding: 10px;
              border-radius: 8px 8px 0 0;
          }
          .email-header h1 {
              margin: 0;
              font-size: 24px;
          }
          .email-body {
              padding: 20px;
          }
          .email-body h2 {
              color: #333333;
              font-size: 18px;
              margin-top: 0;
          }
          .details-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
          }
          .details-table th, .details-table td {
              text-align: left;
              padding: 10px;
              border-bottom: 1px solid #dddddd;
          }
          .details-table th {
              background-color: #f8f8f8;
              color: #333333;
          }
          .message-box {
              background-color: #f8f8f8;
              padding: 15px;
              border-radius: 8px;
              color: #333333;
              margin-bottom: 20px;
          }
          .footer {
              text-align: center;
              color: #777777;
              font-size: 12px;
          }
      </style>
  </head>
  <body>
  
  <div class="email-container">
      <div class="email-header">
          <h1>New Welding Service Inquiry</h1>
      </div>
      <div class="email-body">
          <h2>Customer Details</h2>
          <table class="details-table">
              <tr>
                  <th>Name</th>
                  <td>${toName}</td>
              </tr>
              <tr>
                  <th>Email</th>
                  <td>${toEmail}</td>
              </tr>
              <tr>
                  <th>Phone Number</th>
                  <td>${phoneNo}</td>
              </tr>
              <tr>
                  <th>Preferred Contact Method</th>
                  <td>-</td>
              </tr>
          </table>
  
          <h2>Message</h2>
          <div class="message-box">
            ${message}
          </div>
  
          <p>Please review the above details and reach out to the customer as soon as possible.</p>
      </div>
      <div class="footer">
          <p>Note: This email was generated automatically from your website's Contact Us form. Please ensure that you follow up with the customer promptly.</p>
      </div>
  </div>
  
  </body>
  </html>`;
  transport
    .sendMail({
      from: {
        name: "Support",
        address: toEmail,
      },
      to: "cheritcherry@gmail.com",
      subject: "subject",
      html: template,
    })
    .then(() => {
      console.log("email sent");
    })
    .catch((e) => {
      console.log(e);
    });

  res.json({ message: "Form submitted successfully", data: formData });
});

module.exports = app;
