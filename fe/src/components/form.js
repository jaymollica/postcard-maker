import './Form.css';
import React, { useState } from 'react';
import { AddressForm, verify } from '@lob/react-address-autocomplete'
import { lob_publishable_api_key_live } from './../config.js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';

export default function Form(props){

	const [address, setAddress] = useState({})
	const [verifying, setVerifying] = useState(false)	
	const {fullName, setFullName, setBillingDetails, postcardGenerated, setAddressVerified, addressVerified} = props;

	const handleFieldChange = (payload) => {
		setAddress(payload.address)
	}

	const handleSelectAddress = (selection) => {
		setAddress(selection.value)
	}

	const submitHandler = () => {
		setVerifying(true);
		
		console.log('address', address)
		if( fullName.length === 0 ){
			setVerifying(false);
			// No popup message - user will see the button return to normal state
		}
		else{
			verify(lob_publishable_api_key_live, address).then((verificationResult) => {
				setVerifying(false);
				console.log('Verification Results', verificationResult)
				if( verificationResult.valid_address && verificationResult.deliverability !== 'undeliverable' ){
					setAddressVerified(true);
					setBillingDetails({
						line1: verificationResult.primary_line,
						line2: verificationResult.secondary_line,
						city: verificationResult.components.city,
						state: verificationResult.components.state,
						postal_code: verificationResult.components.zip_code,
						name: fullName
					});
				}
				else{
					// Address verification failed - button will return to normal state
					// User can try again without any popup message
				}

			}).catch( (err) => {
				setVerifying(false);
				console.log(err, err.message)
				// Error occurred - button will return to normal state
			} )
		}
	}

	if( postcardGenerated ){
		return (
			<div className={`addressform ${addressVerified ? 'verified' : (verifying ? 'verifying' : '')}` }>
				<h2>Delivery Address</h2>
				<div className="description">Enter the address where you'd like your postcard delivered. We'll verify it to ensure successful delivery.</div>
				
				<AddressForm
					apiKey={lob_publishable_api_key_live}
					onSelection={handleSelectAddress}
					onFieldChange={handleFieldChange}
					onSubmit={submitHandler}
					submitButtonLabel={addressVerified ? ButtonLabelVerified('Address Verified') : (verifying ? ButtonLabelVerifying('Verifying Address') : ButtonLabelVerify('Verify Address'))}
				>
					<div style={{display: 'flex', flexDirection: 'row', marginBottom: '1em'}}>
						<label style={{alignSelf: 'center', minWidth: '5em', marginRight: '1em', textAlign: 'end'}} htmlFor='full_name'>
							Full name
						</label>
						<input
							style={{ 
								backgroundColor: 'rgb(255, 255, 255)',
								border: '1px solid rgb(204, 204, 204)',
								borderRadius: '4px',
								boxSizing: 'border-box',
								minHeight: '38px',
								outline: '0px',
								padding: '0px 8px',
								width: '100%',
								marginBottom: 'auto',

							}}
							id='full_name'
							onChange={ e => setFullName(e.target.value) }
							value={fullName}
							placeholder="Enter your full name"
						/>
					</div>
				</AddressForm>
				
		    </div>
		);
	}
}