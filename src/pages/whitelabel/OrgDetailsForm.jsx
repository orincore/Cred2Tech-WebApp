import React from 'react';
import { Field, Grid } from './atoms';
import CustomSelect from '../../components/CustomSelect';

// The organisation's own details: who they are and who administers the account. The administrator email receives the
// invite link (no password is ever emailed or shown), so it is required.
export const DETAIL_KEYS = ['display_name', 'legal_name', 'contact_name', 'contact_email', 'contact_mobile', 'pan_number', 'gst_number', 'state', 'city', 'pincode', 'address_line'];

// Same list the sourcing-partner sign-up uses (components/LocationStateDropdown.jsx), so the stored value matches elsewhere.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const Input = ({ id, value, onChange, ...rest }) => (
  <input id={id} className="form-control" value={value ?? ''} onChange={(e) => onChange(e.target.value)} autoComplete="off" {...rest} />
);

const OrgDetailsForm = ({ values, onChange, errors = {}, disabled = false }) => {
  const set = (k) => (v) => onChange({ ...values, [k]: v });
  const f = (k, label, props = {}) => (
    <Field label={label} required={props.required} htmlFor={`wl-${k}`} error={errors[k]} hint={props.hint}>
      <Input id={`wl-${k}`} value={values[k]} onChange={set(k)} disabled={disabled} {...props.input} />
    </Field>
  );
  return (
    <div>
      <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>Organisation</h4>
      <Grid>
        {f('display_name', 'Name shown to its users', { required: true, input: { maxLength: 80, placeholder: 'Acme Finance' }, hint: 'This replaces "Cred2Tech" everywhere its users look.' })}
        {f('legal_name', 'Registered company name', { input: { maxLength: 160, placeholder: 'Acme Finance Private Limited' } })}
        {f('pan_number', 'PAN', { input: { maxLength: 10, placeholder: 'ABCDE1234F', style: { textTransform: 'uppercase' } } })}
        {f('gst_number', 'GSTIN', { input: { maxLength: 15, placeholder: '29ABCDE1234F1Z5', style: { textTransform: 'uppercase' } } })}
      </Grid>
      <h4 style={{ margin: '14px 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>Administrator</h4>
      <Grid>
        {f('contact_name', 'Administrator name', { input: { maxLength: 80, placeholder: 'Full name' } })}
        {f('contact_email', 'Administrator email', { required: true, input: { type: 'email', maxLength: 120, placeholder: 'admin@acme.in' }, hint: 'The invite to set a password is sent here.' })}
        {f('contact_mobile', 'Administrator mobile', { input: { inputMode: 'numeric', maxLength: 10, placeholder: '9876543210' } })}
      </Grid>
      <h4 style={{ margin: '14px 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-muted)' }}>Address</h4>
      <Grid>
        {f('address_line', 'Address', { input: { maxLength: 200 } })}
        {f('city', 'City', { input: { maxLength: 60 } })}
        <Field label="State" htmlFor="wl-state" error={errors.state}>
          <CustomSelect id="wl-state" name="state" className="form-control" searchable searchPlaceholder="Search state" placeholder="Select a state" style={{ width: '100%' }}
            value={values.state ?? ''} onChange={(e) => set('state')(e.target.value)} disabled={disabled}>
            <option value="">Select a state</option>
            {/* keep a value saved before this was a dropdown selectable, so editing never silently drops it */}
            {values.state && !INDIAN_STATES.includes(values.state) && <option value={values.state}>{values.state}</option>}
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </CustomSelect>
        </Field>
        {f('pincode', 'Pincode', { input: { inputMode: 'numeric', maxLength: 6 } })}
      </Grid>
    </div>
  );
};

export default OrgDetailsForm;
