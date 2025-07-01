const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENGGRIDKEY);




const SendgridEmail = async (email, subject, html) => {
    try {
        const msg = {
            to: email,
            from: 'shaian@cartlee.ai', // Use the email address or domain you verified above
            subject: subject,
            text: 'and easy to do anywhere, even with Node.js',
            html: html, // Use rendered HTML from EJS
        };

        const d = await sgMail.send(msg)
    } catch (error) {
        console.log(error.message)
    }
}


module.exports = { SendgridEmail }