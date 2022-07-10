const video = document.getElementById('video')


async function trainingData() {
  const labels = ['Bao', 'Cat'];
  const faceDescriptors = [];

  for(const label of labels) {
    const descriptors = []
    for(let i=1; i<=4; i++) {
      const image = await faceapi.fetchImage(`/data/${label}/${i}.JPG`);
      const detection = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor()

      descriptors.push(detection.descriptor)
    }

    faceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptors));
  }

  return faceDescriptors
}

let faceMatcher, net
async function init() {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    // load api of detect object
    net = await cocoSsd.load()
  ]).then(startVideo)

  const trainData = await trainingData()
  console.log(trainData)

  // face matcher with list of image, system have trained before, second parameter is exactly of recognize this face
  // second parameter is threshold to compare with the confidence of the object detected
  faceMatcher = new faceapi.FaceMatcher(trainData, 0.6)
}

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  )
}

video.addEventListener('play', () => {
  // name of person from recognize face
  let name, nameViolator

  const canvas = faceapi.createCanvasFromMedia(video)
  document.body.append(canvas)
  const displaySize = { width: video.width, height: video.height }
  faceapi.matchDimensions(canvas, displaySize)
  setInterval(async () => {
    // Make Detections

    // detect object
    const obj = await net.detect(video);
    // detect all face
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions().withFaceDescriptors()
    
    // resizedDetections from displaySize 
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    // clear rect before
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    faceapi.draw.drawDetections(canvas, resizedDetections)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

    console.log(obj)

    // position of context 
    const ctx = canvas.getContext('2d')

    obj.forEach(prediction => {
      // console.log('aa' + localStorage.getItem('nameViolator'))
      // handle string violated
      if(localStorage.getItem('nameViolator')) {
        if(localStorage.getItem('nameViolator').length > 9)
        nameViolator = localStorage.getItem('nameViolator').substring(0, localStorage.getItem('nameViolator').length - 6);
        else {
          nameViolator = localStorage.getItem('nameViolator')
        }
        console.log('test'+nameViolator)
      }

      // get position of object to draw rect
      const [x, y, width, height] = prediction['bbox'];

      // kind of object
      const text = prediction['class'];
      if(text==='person' && obj.length === 1) {
        for(const detection of resizedDetections) {
          // position of box to draw box from detect position of face 
          const box = detection.detection.box
          name = faceMatcher.findBestMatch(detection.descriptor).toString()

          
          // display name and bounding box cover this object when detected successful
          const drawBox = new faceapi.draw.DrawBox(box, {
            label: name
          })
          // draw to canvas
          drawBox.draw(canvas)
          // draw rect to object detection
          ctx.fillStyle = '#' + Math.floor(Math.random()*16777215).toString(16);
          ctx.beginPath();
          ctx.fillText(prediction['class'], x, y);
          ctx.rect(x, y, width, height); 
          ctx.stroke();
        } 

        // unknown face when detect
        if(typeof(name)==='undefined' || name.includes('unknown') || name.includes('undefined')) {
          // console.log('unknown face')
          Toastify({
            text: `Unknown face`
          }).showToast();
        }
        // if person been violator
        else if(name.substring(0, name.length - 6)===nameViolator) {
          Toastify({
            text: `${name} have been violated`
          }).showToast();
          console.log(1);
        }
        else {
          Toastify({
            text: `${name} take a roll-call successful`
          }).showToast();
        }
      }
      else {
        for(const detection of resizedDetections) {
          // position of box to draw box from detect position of face 
          const box = detection.detection.box
          nameViolator = faceMatcher.findBestMatch(detection.descriptor).toString()

          const drawBox = new faceapi.draw.DrawBox(box, {
            label: nameViolator
          })
          // draw to canvas
          drawBox.draw(canvas)
        }
        //set violator name to localStorage
        if(!nameViolator.includes('unknown')) {
          localStorage.setItem(`nameViolator`, nameViolator)
        }

        Toastify({
          text: `Please don't use phone or image to take roll-call`
        }).showToast(); 
      }
    })


  }, 1000 );
})

init();