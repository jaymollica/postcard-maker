import './Form.css';
import React, { useState } from 'react';
import { AddressForm, verify } from '@lob/react-address-autocomplete'
import { lob_publishable_api_key_live } from './../config.js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';

export default function Form(props){

	const [address, setAddress] = useState({})
	const [messages, setMessages] = useState('')
	const [messageType, setMessageType] = useState('') // 'error', 'success', or ''
	const [verifying, setVerifying] = useState(false)	
	const {fullName, setFullName, setBillingDetails, postcardGenerated, setAddressVerified, addressVerified} = props;


	const handleFieldChange = (payload) => {
		// Clear messages when user starts typing
		if (messages && messageType === 'error') {
			setMessages('');
			setMessageType('');
		}
		setAddress(payload.address)
	}

	const handleSelectAddress = (selection) => {
		setAddress(selection.value)
		// Clear any existing messages when address is selected
		setMessages('');
		setMessageType('');
	}

	const submitHandler = () => {
		setVerifying(true);
		setMessages('');
		setMessageType('');
		
		console.log('address', address)
		if( fullName.length === 0 ){
			setMessages('Please enter your full name');
			setMessageType('error');
			setVerifying(false);
		}
		else{
			verify(lob_publishable_api_key_live, address).then((verificationResult) => {
				setVerifying(false);
				console.log('Verification Results', verificationResult)
				if( verificationResult.valid_address && verificationResult.deliverability !== 'undeliverable' ){
					setAddressVerified(true);
					setMessages('Address verified successfully');
					setMessageType('success');
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
					setMessages('Address cannot be verified or is undeliverable. Please check and try again.');
					setMessageType('error');
				}

			}).catch( (err) => {
				setVerifying(false);
				console.log(err, err.message)
				setMessages(err.message || 'Address verification failed. Please try again.');
				setMessageType('error');
			} )
		}
	}

	if( postcardGenerated ){
		return (
			<div className={`addressform ${addressVerified ? 'verified' : (verifying ? 'verifying' : '')}` }>
				<h2>Delivery Address</h2>
				<div className="description">Enter the address where you'd like your postcard delivered. We'll verify it to ensure successful delivery.</div>
				
				{/* Status Messages */}
				{messages && (
					<div className={`status-indicator ${messageType}`}>
						{messageType === 'success' && (
							<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
							</svg>
						)}
						{messageType === 'error' && (
							<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
								<path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
							</svg>
						)}
						{messages}
					</div>
				)}
				
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
							onChange={ e => {
								setFullName(e.target.value)
								// Clear name-related errors when typing
								if (messages.includes('name')) {
									setMessages('');
									setMessageType('');
								}
							} }
							value={fullName}
							placeholder="Enter your full name"
						/>
					</div>
				</AddressForm>
				
		    </div>
		);
	}
}