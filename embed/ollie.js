const BACKEND_URL = 'http://localhost:9999';
const FRONTEND_ORIGIN = 'localhost:8888';

function Lobby({button, canvas,  ...optionalParams} = {}){

	this._send = async function({canvas, nonce, optionalParams}){

		//alert(this.optionalParams.getMessage);
		canvas = canvas instanceof HTMLElement === false && typeof canvas === 'string' ? document.querySelector(canvas) : canvas;

		const imageData = canvas.toDataURL('image/jpeg');

		console.log(optionalParams);
	
		const res = await fetch(BACKEND_URL + '/img', {
			method: "POST",
			body: JSON.stringify({
				items: [
					{
						id: "postcard-4x6"
					}
				],
				imageData: imageData,
				nonce: nonce,
				optionalParams: optionalParams,

			}),
			credentials: 'same-origin',
			cache: 'no-cache',
			redirect: 'follow',
			headers: {
				"Content-Type": "application/json",
				'Access-Control-Allow-Origin': window.location.host
			}
		});

		const data = await res.json();

		// this will be replaced by AWS call to store img object & get URL
		const imageUrl = data.url;
		if( imageUrl ){
			let url = "//" + FRONTEND_ORIGIN + "?imgUrl=" + encodeURIComponent(imageUrl);
			if( typeof optionalParams !== 'undefined' && Object.keys(optionalParams).length > 0 ){
				// Use simple URL encoding instead of base64 to avoid Unicode issues
				url += '&optionalParams=' + encodeURIComponent(JSON.stringify(optionalParams));
			}
			url += '&artistUrl=' + encodeURIComponent(window.location.origin);
			window.open(url, "_self");
		}
	}

	this._buttonClickHandler = async function(context, e) {
		try {
			e.preventDefault();
			this.button.classList.add('disable');
			const { canvas, nonce } = context;
	
			await this._send({
				canvas : canvas,
				nonce: nonce,
				optionalParams, optionalParams
			});
		} catch (error) {
			console.error('An error occurred:', error);
		}
	}

	this._getNonce = async function(returnNonce = false){
		try {
			const res = await fetch(BACKEND_URL + '/nonce', {
				method: "POST",
				credentials: 'same-origin',
				cache: 'no-cache',
				redirect: 'follow',
				headers: {
					"Content-Type": "application/json",
					'Access-Control-Allow-Origin': window.location.host
				}
			});

			const data = await res.json();

			this.nonce = data.nonce;

			if( returnNonce ){
				return data.nonce;
			}
		} catch (error) {
			console.error(error);
		}
	}

	// make the button & canvas objects
	if (button instanceof HTMLElement === false && typeof button === 'string' && button.length > 0) {
		this.button = document.querySelector(button);
	}
	else if ( typeof button === 'undefined' || button.length === 0 ){
		return {
			send : this._send,
			getNonce: this._getNonce,
		}
	}
	else {
		this.button = thing;
	}

	this.canvas = canvas instanceof HTMLElement === false && typeof canvas === 'string' ? document.querySelector(canvas) : canvas;

	this.button.addEventListener('click', this._buttonClickHandler.bind(null, this), {once : true});

	document.addEventListener('DOMContentLoaded', this._getNonce.bind(null, this));
}