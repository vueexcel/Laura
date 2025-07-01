const asyncHandler = require('express-async-handler');
var path = require('path');
const { returnResponse } = require('../middleware/common');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const fs = require('fs');

const S3 = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.S3KEY,
        secretAccessKey: process.env.S3SECRET,
    },
});


const BUCKET_NAME = process.env.FILEUPLOADBUCKETNAME;

const uploadFileApi = asyncHandler(async (req, res) => {
    const file = req.files.file;
    var ext = file.name.split(".")
    var imagenamefinal = file.name.replace(file.name, (new Date).getTime() + "." + ext[ext.length - 1]);
    const ContentType = imagenamefinal.split('.')
    const myBucket = BUCKET_NAME,
        myKey = imagenamefinal,
        params = {
            Body: file.data,  // file buffer data
            Bucket: myBucket,  // bucket name
            Key: myKey,  // file name to be stored as in s3
            ContentType: ContentType[ContentType.length - 1],
            ACL: "public-read-write",
        };

    try {
        const uploadResponse = await S3.send(new PutObjectCommand(params));
        return returnResponse(200, 'added successfully', {
            fileUrl: `${process.env.IMAGEBASEURLAWS}${imagenamefinal}`,
            fileName: imagenamefinal,
        }, res);
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        return PrintError(400, error.message, res);
    }
})

module.exports = { uploadFileApi }