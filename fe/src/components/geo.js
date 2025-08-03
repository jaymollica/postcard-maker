import React, { useState } from 'react';
import './Geo.css';

export default function Geo(props){

	const [buttonText, setButtonText] = useState('MAKE POSTCARD');
	const [imageLoaded, setimageLoaded] = useState(false);
	const [imageLoading, setimageLoading] = useState(false);

	const makePostcard = () => {
		setimageLoading(true);
		setButtonText('MAKING POSTCARD 🔄');
		const canvas = document.querySelector('.postcardart');
		const context = canvas.getContext('2d');
		
		let image = new Image();

		// appending unique value in url params refreshes the browser cache
		const d = new Date();
		image.src = 'https://cataas.com/cat/says/PAmM%20CAN%20MAKE%20aRT%20T0o?meh=' + d.getTime();

		image.onload = () => {
			for( let y = 0; y < Math.ceil(canvas.height / image.height); y++ ){
				for( let x = 0; x < Math.ceil(canvas.width / image.width); x++ ){
					context.drawImage(image, x * image.width, y * image.height);
				}
			}
			props.postcardGeneratedCallback()
			setButtonText('MADE POSTCARD ✅');
			setimageLoading(false);
			setimageLoaded(true);
		}


	}
	return (
		<div className="artgen">
			<canvas className="postcardart" width="1800px" height="1200px"></canvas>
			<div disabled={imageLoading} className={`makepostcard ${imageLoading ? 'imageloading' : ''} ${imageLoaded ? 'imageloaded' : ''}`} onClick={makePostcard}>{buttonText}</div>
		</div>
	);	
}