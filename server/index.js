const express = require("express");
const app = express();
const mailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

app.use(bodyParser.json());
app.use(cors());

app.listen(3001, () => {
  console.log("server started");
});
app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.post("/submit-form", (req, res) => {
  const formData = req.body;
  console.log("Form data received:", formData);
  const toEmail = formData?.email;
  const toName = formData?.name;
  const message = formData?.message;
  const htmlMsg = "<div>";
  const transport = mailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "cheritcherry@gmail.com",
      pass: "vtre vvbi ffwb hpwb",
    },
  });
  transport
    .sendMail({
      from: {
        name: "Support",
        address: "cheritcherry@gmail.com",
      },
      to: toEmail,
      subject: "subject",
      html: `<div>Hello ${toName},</div>
           <div>${message}</div>`,
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
