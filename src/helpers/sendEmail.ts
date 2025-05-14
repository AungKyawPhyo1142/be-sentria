import hbs from 'nodemailer-express-handlebars'
import { ENV } from '@/env'
import * as nodemailer from 'nodemailer'
import * as path from 'path'

export const sendEmail = async (
    templateFileName: string,
    templateGroupName: string,
    sendToList: (string | undefined)[],
    subject: string,
    data: any,

) => {
    const transporter = nodemailer.createTransport({
        host: "gmail",
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: ENV.RESET_PASSWORD_SENDER_EMAIL,
            // clientId: process.env.GOOGLE_CLIENT_ID,
            // clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            accessToken: process.env.GOOGLE_ACCESS_TOKEN, 
        },
    })

    // wait for the transporter to be ready
    await transporter.verify()

    // use a template file with nodemailer
    transporter.use(
        "compile",
        hbs({
            viewEngine: {
                extname: ".hbs",
                defaultLayout: '',
                partialsDir: path.resolve(`./src/views/emails/${templateGroupName}`),
            },
            viewPath: path.resolve(`./src/views/emails/${templateGroupName}`),
            extName: ".hbs",
        })
    );

    for (const email of sendToList) {
        if (email) {
            const mailOptions = {
                from: `Sentria Support <${ENV.RESET_PASSWORD_SENDER_EMAIL}>`,
                template: templateFileName,
                to: email,
                subject: subject,
                context: data,
                attachments: [{
                    filename: 'sentria-logo.png',
                    path: path.resolve(`./src/views/logo/sentria-logo.png`),
                    cid: 'logo'
                }]
            };
            try {
                await transporter.sendMail(mailOptions);
                console.log(`Email sent to ${email}`);
            } catch (error) {
                console.log(`Error sending email to ${email}: ${error}`);
            }
        }
    }

}