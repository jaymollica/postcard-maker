import './Form.css';
import React, { useState } from 'react';
import { AddressForm, verify } from '@lob/react-address-autocomplete'
import { lob_publishable_api_key_live } from './../config.js';

import { ButtonLabelVerify, ButtonLabelVerifying, ButtonLabelVerified } from './ButtonLabels';
import { track } from './../analytics.js';

// ISO 3166-1 alpha-2 country codes + names, US first then alphabetical.
const COUNTRIES = [
	['US', 'United States'],
	['AF', 'Afghanistan'],
	['AX', 'Åland Islands'],
	['AL', 'Albania'],
	['DZ', 'Algeria'],
	['AS', 'American Samoa'],
	['AD', 'Andorra'],
	['AO', 'Angola'],
	['AI', 'Anguilla'],
	['AQ', 'Antarctica'],
	['AG', 'Antigua and Barbuda'],
	['AR', 'Argentina'],
	['AM', 'Armenia'],
	['AW', 'Aruba'],
	['AU', 'Australia'],
	['AT', 'Austria'],
	['AZ', 'Azerbaijan'],
	['BS', 'Bahamas'],
	['BH', 'Bahrain'],
	['BD', 'Bangladesh'],
	['BB', 'Barbados'],
	['BY', 'Belarus'],
	['BE', 'Belgium'],
	['BZ', 'Belize'],
	['BJ', 'Benin'],
	['BM', 'Bermuda'],
	['BT', 'Bhutan'],
	['BO', 'Bolivia'],
	['BQ', 'Bonaire, Sint Eustatius and Saba'],
	['BA', 'Bosnia and Herzegovina'],
	['BW', 'Botswana'],
	['BV', 'Bouvet Island'],
	['BR', 'Brazil'],
	['IO', 'British Indian Ocean Territory'],
	['BN', 'Brunei Darussalam'],
	['BG', 'Bulgaria'],
	['BF', 'Burkina Faso'],
	['BI', 'Burundi'],
	['CV', 'Cabo Verde'],
	['KH', 'Cambodia'],
	['CM', 'Cameroon'],
	['CA', 'Canada'],
	['KY', 'Cayman Islands'],
	['CF', 'Central African Republic'],
	['TD', 'Chad'],
	['CL', 'Chile'],
	['CN', 'China'],
	['CX', 'Christmas Island'],
	['CC', 'Cocos (Keeling) Islands'],
	['CO', 'Colombia'],
	['KM', 'Comoros'],
	['CG', 'Congo'],
	['CD', 'Congo (Democratic Republic)'],
	['CK', 'Cook Islands'],
	['CR', 'Costa Rica'],
	['CI', 'Côte d\'Ivoire'],
	['HR', 'Croatia'],
	['CU', 'Cuba'],
	['CW', 'Curaçao'],
	['CY', 'Cyprus'],
	['CZ', 'Czechia'],
	['DK', 'Denmark'],
	['DJ', 'Djibouti'],
	['DM', 'Dominica'],
	['DO', 'Dominican Republic'],
	['EC', 'Ecuador'],
	['EG', 'Egypt'],
	['SV', 'El Salvador'],
	['GQ', 'Equatorial Guinea'],
	['ER', 'Eritrea'],
	['EE', 'Estonia'],
	['SZ', 'Eswatini'],
	['ET', 'Ethiopia'],
	['FK', 'Falkland Islands'],
	['FO', 'Faroe Islands'],
	['FJ', 'Fiji'],
	['FI', 'Finland'],
	['FR', 'France'],
	['GF', 'French Guiana'],
	['PF', 'French Polynesia'],
	['TF', 'French Southern Territories'],
	['GA', 'Gabon'],
	['GM', 'Gambia'],
	['GE', 'Georgia'],
	['DE', 'Germany'],
	['GH', 'Ghana'],
	['GI', 'Gibraltar'],
	['GR', 'Greece'],
	['GL', 'Greenland'],
	['GD', 'Grenada'],
	['GP', 'Guadeloupe'],
	['GU', 'Guam'],
	['GT', 'Guatemala'],
	['GG', 'Guernsey'],
	['GN', 'Guinea'],
	['GW', 'Guinea-Bissau'],
	['GY', 'Guyana'],
	['HT', 'Haiti'],
	['HM', 'Heard Island and McDonald Islands'],
	['VA', 'Holy See (Vatican City)'],
	['HN', 'Honduras'],
	['HK', 'Hong Kong'],
	['HU', 'Hungary'],
	['IS', 'Iceland'],
	['IN', 'India'],
	['ID', 'Indonesia'],
	['IR', 'Iran'],
	['IQ', 'Iraq'],
	['IE', 'Ireland'],
	['IM', 'Isle of Man'],
	['IL', 'Israel'],
	['IT', 'Italy'],
	['JM', 'Jamaica'],
	['JP', 'Japan'],
	['JE', 'Jersey'],
	['JO', 'Jordan'],
	['KZ', 'Kazakhstan'],
	['KE', 'Kenya'],
	['KI', 'Kiribati'],
	['KP', 'Korea (North)'],
	['KR', 'Korea (South)'],
	['KW', 'Kuwait'],
	['KG', 'Kyrgyzstan'],
	['LA', 'Laos'],
	['LV', 'Latvia'],
	['LB', 'Lebanon'],
	['LS', 'Lesotho'],
	['LR', 'Liberia'],
	['LY', 'Libya'],
	['LI', 'Liechtenstein'],
	['LT', 'Lithuania'],
	['LU', 'Luxembourg'],
	['MO', 'Macao'],
	['MG', 'Madagascar'],
	['MW', 'Malawi'],
	['MY', 'Malaysia'],
	['MV', 'Maldives'],
	['ML', 'Mali'],
	['MT', 'Malta'],
	['MH', 'Marshall Islands'],
	['MQ', 'Martinique'],
	['MR', 'Mauritania'],
	['MU', 'Mauritius'],
	['YT', 'Mayotte'],
	['MX', 'Mexico'],
	['FM', 'Micronesia'],
	['MD', 'Moldova'],
	['MC', 'Monaco'],
	['MN', 'Mongolia'],
	['ME', 'Montenegro'],
	['MS', 'Montserrat'],
	['MA', 'Morocco'],
	['MZ', 'Mozambique'],
	['MM', 'Myanmar'],
	['NA', 'Namibia'],
	['NR', 'Nauru'],
	['NP', 'Nepal'],
	['NL', 'Netherlands'],
	['NC', 'New Caledonia'],
	['NZ', 'New Zealand'],
	['NI', 'Nicaragua'],
	['NE', 'Niger'],
	['NG', 'Nigeria'],
	['NU', 'Niue'],
	['NF', 'Norfolk Island'],
	['MK', 'North Macedonia'],
	['MP', 'Northern Mariana Islands'],
	['NO', 'Norway'],
	['OM', 'Oman'],
	['PK', 'Pakistan'],
	['PW', 'Palau'],
	['PS', 'Palestine'],
	['PA', 'Panama'],
	['PG', 'Papua New Guinea'],
	['PY', 'Paraguay'],
	['PE', 'Peru'],
	['PH', 'Philippines'],
	['PN', 'Pitcairn'],
	['PL', 'Poland'],
	['PT', 'Portugal'],
	['PR', 'Puerto Rico'],
	['QA', 'Qatar'],
	['RE', 'Réunion'],
	['RO', 'Romania'],
	['RU', 'Russia'],
	['RW', 'Rwanda'],
	['BL', 'Saint Barthélemy'],
	['SH', 'Saint Helena'],
	['KN', 'Saint Kitts and Nevis'],
	['LC', 'Saint Lucia'],
	['MF', 'Saint Martin (French)'],
	['PM', 'Saint Pierre and Miquelon'],
	['VC', 'Saint Vincent and the Grenadines'],
	['WS', 'Samoa'],
	['SM', 'San Marino'],
	['ST', 'Sao Tome and Principe'],
	['SA', 'Saudi Arabia'],
	['SN', 'Senegal'],
	['RS', 'Serbia'],
	['SC', 'Seychelles'],
	['SL', 'Sierra Leone'],
	['SG', 'Singapore'],
	['SX', 'Sint Maarten (Dutch)'],
	['SK', 'Slovakia'],
	['SI', 'Slovenia'],
	['SB', 'Solomon Islands'],
	['SO', 'Somalia'],
	['ZA', 'South Africa'],
	['GS', 'South Georgia and South Sandwich Islands'],
	['SS', 'South Sudan'],
	['ES', 'Spain'],
	['LK', 'Sri Lanka'],
	['SD', 'Sudan'],
	['SR', 'Suriname'],
	['SJ', 'Svalbard and Jan Mayen'],
	['SE', 'Sweden'],
	['CH', 'Switzerland'],
	['SY', 'Syria'],
	['TW', 'Taiwan'],
	['TJ', 'Tajikistan'],
	['TZ', 'Tanzania'],
	['TH', 'Thailand'],
	['TL', 'Timor-Leste'],
	['TG', 'Togo'],
	['TK', 'Tokelau'],
	['TO', 'Tonga'],
	['TT', 'Trinidad and Tobago'],
	['TN', 'Tunisia'],
	['TR', 'Turkey'],
	['TM', 'Turkmenistan'],
	['TC', 'Turks and Caicos Islands'],
	['TV', 'Tuvalu'],
	['UG', 'Uganda'],
	['UA', 'Ukraine'],
	['AE', 'United Arab Emirates'],
	['GB', 'United Kingdom'],
	['UM', 'United States Minor Outlying Islands'],
	['UY', 'Uruguay'],
	['UZ', 'Uzbekistan'],
	['VU', 'Vanuatu'],
	['VE', 'Venezuela'],
	['VN', 'Vietnam'],
	['VG', 'Virgin Islands (British)'],
	['VI', 'Virgin Islands (U.S.)'],
	['WF', 'Wallis and Futuna'],
	['EH', 'Western Sahara'],
	['YE', 'Yemen'],
	['ZM', 'Zambia'],
	['ZW', 'Zimbabwe'],
];

export default function Form(props){

	const [address, setAddress] = useState({})
	const [verifying, setVerifying] = useState(false)
	const [country, setCountry] = useState('US')
	const {recipientName, setRecipientName, setBillingDetails, postcardGenerated, setAddressVerified, addressVerified} = props;

	const handleFieldChange = (payload) => {
		setAddress(payload.address)
	}

	const handleSelectAddress = (selection) => {
		setAddress(selection.value)
	}

	const submitHandler = () => {
		setVerifying(true);

		console.log('address', address)
		if( recipientName.length === 0 ){
			setVerifying(false);
			// No popup message - user will see the button return to normal state
		}
		else if( country === 'US' ){
			// Use Lob verification for US addresses
			verify(lob_publishable_api_key_live, address).then((verificationResult) => {
				setVerifying(false);
				console.log('Verification Results', verificationResult)
				if( verificationResult.valid_address && verificationResult.deliverability !== 'undeliverable' ){
					setAddressVerified(true);
					track('address_verified', { country: country });
					// Lob's verify can fold the apt/suite into primary_line and
					// return an empty secondary_line. Fall back to what the user
					// typed so line2 reflects the original input.
					const line2 = verificationResult.secondary_line || address.secondary_line || '';
					setBillingDetails({
						line1: verificationResult.primary_line,
						line2: line2,
						city: verificationResult.components.city,
						state: verificationResult.components.state,
						postal_code: verificationResult.components.zip_code,
						name: recipientName,
						country: country
					});
					// AddressForm wipes its own secondary_line input after verify
					// (uncontrolled input, no `value` prop exposed). Push the value
					// back into both the DOM and React's internal state via the
					// native setter trick so what's shown matches what's sent.
					if( line2 ){
						const input = document.getElementById('secondary_line');
						if( input ){
							const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
							setter.call(input, line2);
							input.dispatchEvent(new Event('input', { bubbles: true }));
						}
					}
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
		else{
			// International address - skip Lob verification and use address as-is
			setVerifying(false);
			setAddressVerified(true);
			track('address_verified', { country: country });
			setBillingDetails({
				line1: address.primaryLine || address.address1 || '',
				line2: address.secondaryLine || address.address2 || '',
				city: address.city || '',
				state: address.state || '',
				postal_code: address.postalCode || address.zipCode || '',
				name: recipientName,
				country: country
			});
		}
	}

	const inputStyle = {
		backgroundColor: 'rgb(255, 255, 255)',
		border: '1px solid rgb(204, 204, 204)',
		borderRadius: '4px',
		boxSizing: 'border-box',
		minHeight: '38px',
		outline: '0px',
		padding: '0px 8px',
		width: '100%',
		marginBottom: 'auto',
	};

	const fieldStyle = {
		display: 'flex',
		flexDirection: 'row',
		marginBottom: '1em'
	};

	const labelStyle = {
		alignSelf: 'center',
		minWidth: '5em',
		marginRight: '1em',
		textAlign: 'end'
	};

	if( postcardGenerated ){
		return (
			<div className={`addressform ${addressVerified ? 'verified' : (verifying ? 'verifying' : '')}` }>
				<h2>Delivery Address</h2>
				<div className="description">
					{country === 'US'
						? "Enter the recipient's name and address where you'd like your postcard delivered. We'll verify it to ensure successful delivery."
						: "Enter the recipient's name and international address. International postcards cost $5.00."
					}
				</div>

				{/* Country Selector */}
				<div style={fieldStyle}>
					<label style={labelStyle} htmlFor='country'>
						Country
					</label>
					<select
						id='country'
						style={inputStyle}
						value={country}
						onChange={(e) => {
							setCountry(e.target.value);
							setAddressVerified(false);
							setAddress({});
						}}
					>
						{COUNTRIES.map(([code, name]) => (
							<option key={code} value={code}>{name}</option>
						))}
					</select>
				</div>

				{/* Recipient Name Field */}
				<div style={fieldStyle}>
					<label style={labelStyle} htmlFor='recipient_name'>
						Recipient name
					</label>
					<input
						style={inputStyle}
						id='recipient_name'
						onChange={ e => setRecipientName(e.target.value) }
						value={recipientName}
						placeholder="Enter recipient's full name"
					/>
				</div>

				{country === 'US' ? (
					// US Address with Lob verification
					<AddressForm
						apiKey={lob_publishable_api_key_live}
						onSelection={handleSelectAddress}
						onFieldChange={handleFieldChange}
						onSubmit={submitHandler}
						submitButtonLabel={addressVerified ? ButtonLabelVerified('Address Verified') : (verifying ? ButtonLabelVerifying('Verifying Address') : ButtonLabelVerify('Verify Address'))}
					/>
				) : (
					// International Address - Manual Entry
					<>
						<div style={fieldStyle}>
							<label style={labelStyle} htmlFor='address1'>
								Address Line 1
							</label>
							<input
								style={inputStyle}
								id='address1'
								onChange={(e) => setAddress({...address, address1: e.target.value})}
								value={address.address1 || ''}
								placeholder="Street address"
							/>
						</div>

						<div style={fieldStyle}>
							<label style={labelStyle} htmlFor='address2'>
								Address Line 2
							</label>
							<input
								style={inputStyle}
								id='address2'
								onChange={(e) => setAddress({...address, address2: e.target.value})}
								value={address.address2 || ''}
								placeholder="Apt, suite, etc. (optional)"
							/>
						</div>

						<div style={fieldStyle}>
							<label style={labelStyle} htmlFor='city'>
								City
							</label>
							<input
								style={inputStyle}
								id='city'
								onChange={(e) => setAddress({...address, city: e.target.value})}
								value={address.city || ''}
								placeholder="City"
							/>
						</div>

						<div style={fieldStyle}>
							<label style={labelStyle} htmlFor='state'>
								State/Province
							</label>
							<input
								style={inputStyle}
								id='state'
								onChange={(e) => setAddress({...address, state: e.target.value})}
								value={address.state || ''}
								placeholder="State or Province"
							/>
						</div>

						<div style={fieldStyle}>
							<label style={labelStyle} htmlFor='postal_code'>
								Postal Code
							</label>
							<input
								style={inputStyle}
								id='postal_code'
								onChange={(e) => setAddress({...address, postalCode: e.target.value})}
								value={address.postalCode || ''}
								placeholder="Postal code"
							/>
						</div>

						<button
							onClick={submitHandler}
							style={{
								width: '100%',
								padding: '12px',
								backgroundColor: addressVerified ? '#28a745' : '#007bff',
								color: 'white',
								border: 'none',
								borderRadius: '4px',
								cursor: 'pointer',
								fontSize: '16px',
								marginTop: '1em'
							}}
						>
							{addressVerified ? '✓ Address Confirmed' : 'Confirm Address'}
						</button>
					</>
				)}

		    </div>
		);
	}
}