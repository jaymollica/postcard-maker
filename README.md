# Postcard Project
Allows for a generative artist to connect their project to a service that sends a physical postcard of an artwork. Artwork must be on a canvas and domain must be allowlisted. Uses Lob & Stripe to send the postcard and capture payment info, respectively.

## Dev
To start a local dev server, run `zsh startdev.sh` (the script uses zsh-style arrays, so plain `sh` won't work on systems where `/bin/sh` is dash). You'll need:

- `be/.env` for the backend (Stripe + Lob keys, Mailchimp, AWS, etc.)
- `fe/.env.development` for the frontend dev build
- `be/.domain-template-map.json` for domain → template/cost config

Deployment is controlled by GitHub Actions — see `.github/workflows/main.yml`. The repo is the source of truth: commits to `main` auto-build and rsync to the production server. Don't edit code directly on the server; the next deploy will overwrite it.

## Artist
For use in your generative art project, you will need to include the embed script and have two elements: a canvas (which contains the art), and a button (when clicked will open a new window to collect name, address and payment info in order to complete the user flow). There's support for additional properties in the `Lobby` function's config (any extra keys beyond `button`/`canvas`). These get passed through as merge variables for the Lob template to ingest — see the [Template Merge Variables](#template-merge-variables) section below for what the default templates expect. When the button has been clicked a class named `disable` will be applied to the element and the listener for the click event will be removed. This will help prevent subsequent requests and allow the artist to conditionally style their button. Example below:



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
Promo codes are managed in Stripe — make sure any you want available are set up in the live environment, not just test (Stripe's docs walk you through copying them over).

When promoting from test to live, you need to update keys in two places:

1. **GitHub Actions** (Settings → Secrets and variables → Actions): replace test keys in repository **vars** (`REACT_APP_STRIPE_PUBLISHABLE_KEY`, etc.) with their live equivalents. These are baked into the FE bundle at build time.
2. **Server `be/.env`**: replace `STRIPE_API_KEY`, `LOB_API_KEY`, etc. with their `sk_live_*` / `live_*` equivalents. These are read at runtime by the backend.

Also confirm Lob's live environment has the correct front/back templates, and that `be/.domain-template-map.json` on the server has the matching live `front_template`/`back_template` IDs for each artist domain.

## Template Merge Variables
The default Lob templates render these merge variables. Pass them via the embed lib's `optionalParams` — each key/value becomes a merge variable that Lob substitutes into `{{variableName}}` placeholders in the template. Variables marked *(auto)* are filled in by the backend, so artists don't need to pass them.

**Artwork**
- `artworkTitle`
- `artworkArtist`
- `artworkYear`
- `artworkMuseum`
- `artworkImageURL` *(auto — set from the canvas upload)*

**Message**
- `userMessage` — text the buyer wants on the postcard

**Footer / branding** (backend supplies defaults if not passed)
- `footerHeader` *(default: "About This Postcard")*
- `footerMessage` *(default: "This postcard features artwork from a public domain collection.")*
- `footerUrl` *(default: "Make your own at www.sweetpost.art")*
- `qrCodeUrl` *(default: `https://www.sweetpost.art`)*

**Address**
- `recipientCountryLine` *(auto — derived from the destination country)* — renders the country line on international postcards. Lob's auto-renderer omits it, so the back template includes `{{#recipientCountryLine}}{{recipientCountryLine}}{{/recipientCountryLine}}` to print it manually. Empty string for US so the line collapses on domestic mail.

## TODO

- **Generalize merge variable names.** The current artwork-prefixed variables (`artworkTitle`, `artworkArtist`, `artworkYear`, `artworkMuseum`, `artworkImageURL`) pin this system to art-gallery semantics, but the underlying capability is "send a postcard with arbitrary front/back content." Rename to presentation-neutral terms — proposed mapping: `artworkTitle` → `title`, `artworkArtist` → `attribution`, `artworkYear` → `date`, `artworkMuseum` → `source`, `artworkImageURL` → `imageURL`. Doable without breaking existing artist integrations: backend can alias old → new and forward both names to Lob during a transition window, so old templates and old artist sites keep working while new ones use the cleaner names. Phase out the old keys later once no Lob template references them.