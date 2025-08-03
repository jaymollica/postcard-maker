# Lob Project
Allows for a generative artist to connect their project to a service that sends a physical postcard of an artwork. Artwork must be on a canvas and domain must be allowlisted. Uses Lob & Stripe to send the postcard and capture payment info, respectively.

## Dev
To start a local dev server, run the startdev.sh script like `sh startdev.sh`. You will need the .env file for the backend, the .env.development and .env.production files for the front end and the .domain-template-map.json file for things to work as expected. Deployment is controlled by Github Actions. See the .github/workflows folder. If you want to change the code on the remote server, deploy commits to the main branch since Github is the source of truth.

## Artist
For use in your generative art project, you will need to include the embed script and have two elements: a canvas (which contains the art), and a button (when clicked will open a new window to collect name, address and payment info in order to complete the user flow). There's support for additional properties in the Lobby function's config. These get translated to merge variables for the Lob API to injest. When the button has been clicked a class named `disable` will be applied to the element and the listener for the click event will be removed. This will help prevent subsequent requests and allow the artist to conditionally style their button. Example below:

```html
<!-- lobby stuff -->
<!-- artwork must be on a canvas -->
<div class="canvascontainer">
    <canvas class="canvascontainer-canvas"></canvas>
</div>
<!-- button can be whatever element -->
<div class="buttoncontainer">
    <div class="buttoncontainer-button">Make a Postcard</div>
</div>
<!-- include the embed script after the elements have been loaded -->
<script type="text/javascript" src="https://www.example.com/embed/"></script>
<!-- optional, but recommended (at least in effect), css -->
<style type="text/css">
    /* style the button when it's disabled */
    .buttoncontainer-button.disable{
        cursor: not-allowed;
    }
</style>
<script type="text/javascript">
    /*
    DEFAULT USAGE:
    button or canvas could be HTMLElement or a selector
    element should be loaded at time of calling the Lobby function
    */
    Lobby({
        button : '.buttoncontainer-button',
        canvas : '.canvascontainer-canvas',
        madeUpParam : 4,
        whatevs : ['one', 'two', 'five']
    });

    /*
    OTHER USAGE:
    in the case where you don't want a canvas/button you can call Lobby() without any params to return an object with params that are functions (getNonce & send). getNonce will get a nonce from the server (be sure to pass in true to return the nonce), send will send to the backend and accepts an object with 3 params (canvas, nonce & optionalParams)
    */
    const interface = Lobby();
    async function sendToLobby(){
        // get the nonce, be sure to pass in true to return the nonce as a string
        const nonce = await interface.getNonce(true);
        try {
            // send to the backend
            await interface.send({
                // can be a selector string or a dom element
                canvas: document.querySelector('.canvascontainer-canvas'),
                // must be a string
                nonce : nonce,
                // leave this ommitted if you have no optionalParams to pass to Lob, otherwise fill with a key/value store of your params like:
                // {
                //     key1: value1,
                //     key2: value2
                //     ... etc
                // }
                optionalParams : {}
            })
            
        } catch (error) {
            console.error(error)
        }
    }
    // instead of listening for a button click, send to backend 5s after the dom has loaded
    document.addEventListener('DOMContentLoaded', function(){
        setTimeout(function(){
            sendToLobby();
        }, 5000)
    });
</script>
```

## Going Live
Promo codes are managed on Stripe. Make sure the ones you want to use are set in live environment not just the test environment. Super easy to change just follow their instructions and copy the config. Also replace the test keys in Settings > Security > Secrets and variables > Actions with their corresponding live keys and in the .env files on the server. Make sure Lob's live env has the correct templates and the .env & .domain-template-map.json files are updated with the corresponding template ids.