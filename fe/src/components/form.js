import './Form.css';
import React, { useState } from 'react';
import { AddressForm, verify } from '@lob/react-address-autocomplete'
import { lob_publishable_api_key_live } from './../config.js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';

export default function Form(props){

	const [address, setAddress] = useState({})
	const [messages, setMessages] = useState('')
	const [verifying, setVerifying] = useState(false)	
	const {email, setEmail, fullName, setFullName, setBillingDetails, postcardGenerated, setAddressVerified, addressVerified} = props;


	const handleFieldChange = (payload) => {
		// console.log(`${payload.event.target.id} Field Change`, payload)
		setAddress(payload.address)
	}

	const handleSelectAddress = (selection) => {
		// console.log('Address Selection', selection)
		setAddress(selection.value)
	}

	const submitHandler = () => {
		setVerifying(true);
		console.log('address', address)
		if( fullName.length === 0 ){
			setMessages('Full name is missing');
			setVerifying(false);
		}
		else if( email.length === 0 ){
			setMessages('Email is missing');
			setVerifying(false);
		}
		else if( email.length !== 0 && email.match(
			// eslint-disable-next-line no-useless-escape
			/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
		  ) === null ){
			setMessages('Email is invalid');
			setVerifying(false);
		}
		else{
			setMessages('')
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
						name: fullName,
						email: email // Add this line
					});
				}
				else{
					setMessages('Your address is undeliverable or cannot be verified. Try a different one.');
				}

			}).catch( (err) => {
				console.log(err, err.message)
				setMessages(err.message);
			} )
		}
	}

	if( postcardGenerated ){
		return (
			<div className={`addressform ${addressVerified ? 'verified' : (verifying ? 'verifying' : '')}` }>
				<h2>Where would you like to send your postcard?</h2>
				<div className="description">Each address is verified to make sure it can receive mail.</div>
				<div className="addressform-messages">{messages}</div>
				<AddressForm
					apiKey={lob_publishable_api_key_live}
					onSelection={handleSelectAddress}
					onFieldChange={handleFieldChange}
					onSubmit={submitHandler}
					submitButtonLabel={addressVerified ? ButtonLabelVerified('Verified') : (verifying ? ButtonLabelVerifying('Verifying') : ButtonLabelVerify('Verify'))}
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
							onChange={ e => {
								setFullName(e.target.value)
							} }
							value={fullName}
						/>
					</div>
					<div style={{display: 'flex', flexDirection: 'row', marginBottom: '1em'}}>
						<label style={{alignSelf: 'center', minWidth: '5em', marginRight: '1em', textAlign: 'end'}} htmlFor='email'>
							Email<br /><small>(for receipt)</small>
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
							type="email"
							id='email'
							onChange={ e => {
								setEmail(e.target.value)
							} }
							value={email}
						/>
					</div>
				</AddressForm>
				
		    </div>
		);
	}
}