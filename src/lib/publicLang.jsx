import React, { useState, useCallback, useEffect } from 'react';
import CustomSelect from '../components/CustomSelect';

// Language support for the three customer-facing link pages (ConsentPage,
// GstAuthPage, ItrAuthPage). Only static page text is translated here; names,
// organisations, GSTINs and messages that come back from the server are shown
// as received.

const STORAGE_KEY = 'c2t_public_lang';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

const DICT = {
  en: {
    // shared
    loadingRequest: 'Loading your request…',
    invalidLinkTitle: 'Invalid Link',
    linkNotAvailable: 'Link Not Available',
    linkInvalidOrExpired: 'This link is invalid or has expired.',
    missingTokenEmail: 'This link is missing its token. Please use the link from your email.',
    missingTokenSms: 'This consent link is missing its token. Please use the link from your SMS.',
    requestedBy: 'Requested by',
    aRepresentative: 'a representative',
    aRepresentativeCap: 'A representative',
    fromOrg: 'from',
    requestRevoked: 'Request Revoked',
    revokedBody: 'This request has been revoked{by}. Please contact your representative if you still need to share your {what} data.',
    revokedBy: ' by {name}',
    linkExpired: 'Link Expired',
    linkExpiredBody: 'This link has expired. Please ask your representative to send you a new one.',
    authorise: 'Authorise',
    authorisationSubmitted: 'Authorisation Submitted',
    submitFailed: 'Failed to submit your authorisation. Please check your details and try again.',
    portalPassword: 'Enter your portal password',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    termsReviewAt: "You can review Cred2Tech's terms of use and privacy policy at",
    language: 'Language',

    // consent page
    consentPageTitle: 'Cred2Tech | Data Consent',
    dataAccessConsent: 'Data Access Consent',
    consentIntro: ', through the Cred2Tech platform, is requesting your consent to access the following information to evaluate your loan eligibility and identify suitable lending options',
    consentFor: ' for {name}',
    dataRequested: 'The following data will be requested',
    noDataUnlessApprove: "No data will be accessed unless you explicitly approve this request. You can review Cred2Tech's",
    termsAndPrivacy: 'Terms of Use and Privacy Policy',
    beforeConsent: 'before providing your consent.',
    agreeText: 'I have read and understood what data will be requested, and I consent to {org}{person} accessing the above information through Cred2Tech to assess my eligibility for a loan.',
    thisPlatform: 'this platform',
    enterOtp: 'Enter OTP',
    otpSentTo: ' sent to {mobile}',
    otpSentToYourMobile: ' sent to your mobile number',
    sixDigitCode: '6-digit code',
    resendOtp: 'Resend OTP',
    resendIn: 'Resend ({s}s)',
    sending: 'Sending…',
    otpValid: "The code is valid for 10 minutes. Didn't get it? Tap Resend OTP.",
    submit: 'Submit',
    consentApproved: 'Consent Approved',
    consentApprovedBody: 'Thank you. Your consent has been recorded and the platform will now proceed with your loan application. You can close this page.',
    consentLinkInvalid: 'This consent link is invalid or has expired.',
    consentRecordFailed: 'Failed to record your consent. Please try again.',
    resendFailed: 'Failed to resend OTP. Please try again.',
    otpResent: 'A new OTP has been sent to your mobile number.',
    dp_BUREAU: 'Credit Bureau Report — your credit history and related credit information',
    dp_PAN: 'PAN Details — PAN-linked details such as name, date of birth and GST registration numbers linked to the PAN',
    dp_BANK: 'Bank Statement Data — account transactions, balances and other information contained in the bank statement provided for analysis',

    // ITR page
    itrPageTitle: 'Cred2Tech | Authorise ITR Access',
    itrHeading: 'Authorise ITR Access',
    itrIntro: 'is requesting access to your Income Tax Return (ITR) filing data to proceed with{who} loan application. Enter your Income Tax e-filing PAN/username and portal password below to authorise this securely.',
    itrNothingAccessed: 'Nothing will be accessed from the Income Tax portal unless you submit this form yourself.',
    panUsername: 'PAN / ITR Username',
    itrPassword: 'ITR Portal Password',
    itrPasswordNote: 'This is the same password you use to log in to the Income Tax e-filing portal — it is sent directly to the portal and is never stored.',
    itrSubmittedBody: 'Thank you. Your ITR portal access has been submitted and your representative will be notified once processing completes. You can close this page.',
    itrWhat: 'ITR',

    // GST page
    gstPageTitle: 'Cred2Tech | Authorise GST Access',
    gstHeading: 'Authorise GST Access',
    gstIntro: 'is requesting access to the GST filing data for{who} GSTIN {gstin} to proceed with the loan application. Enter your GST portal username and password below to authorise this securely.',
    gstNothingAccessed: 'Nothing will be accessed from the GST portal unless you submit this form yourself.',
    gstUsername: 'GST Portal Username',
    gstUsernamePh: 'GST portal username',
    gstPassword: 'GST Portal Password',
    gstPasswordNote: 'This is the same password you use to log in to the GST portal — it is sent directly to the portal and is never stored.',
    gstOtpNote: "After you submit, the GST portal will send an OTP to the mobile/email registered for this username — you'll enter it on the next step. If this GSTIN doesn't have OTP login enabled, the request will fail and you'll need to switch to Password.",
    gstOtpFallback: "{message} If OTP login isn't available for this GSTIN, switch to Password below and try again.",
    optPassword: 'Password',
    optOtp: 'OTP',
    gstSubmittedBody: 'Thank you. Your GST portal access has been submitted and your representative will be notified once processing completes. You can close this page.',
    gstWhat: 'GST',
    enterYourOtp: 'Enter Your OTP',
    gstOtpSentBody: 'The GST portal has sent a one-time password to the mobile number or email registered for {gstin}. Enter it below to complete your authorisation.',
    thisGstin: 'this GSTIN',
    enterOtpPh: 'Enter OTP',
    submitOtp: 'Submit OTP',
    otpSubmitFailed: 'Failed to submit OTP. Please check the code and try again.',
  },

  hi: {
    loadingRequest: 'आपका अनुरोध लोड हो रहा है…',
    invalidLinkTitle: 'अमान्य लिंक',
    linkNotAvailable: 'लिंक उपलब्ध नहीं है',
    linkInvalidOrExpired: 'यह लिंक अमान्य है या इसकी समय-सीमा समाप्त हो चुकी है।',
    missingTokenEmail: 'इस लिंक में टोकन नहीं है। कृपया अपने ईमेल में मिले लिंक का उपयोग करें।',
    missingTokenSms: 'इस सहमति लिंक में टोकन नहीं है। कृपया अपने SMS में मिले लिंक का उपयोग करें।',
    requestedBy: 'अनुरोधकर्ता:',
    aRepresentative: 'एक प्रतिनिधि',
    aRepresentativeCap: 'एक प्रतिनिधि',
    fromOrg: 'की ओर से',
    requestRevoked: 'अनुरोध रद्द किया गया',
    revokedBody: 'यह अनुरोध{by} रद्द कर दिया गया है। यदि आपको अब भी अपना {what} डेटा साझा करना है, तो कृपया अपने प्रतिनिधि से संपर्क करें।',
    revokedBy: ' {name} द्वारा',
    linkExpired: 'लिंक की समय-सीमा समाप्त',
    linkExpiredBody: 'इस लिंक की समय-सीमा समाप्त हो चुकी है। कृपया अपने प्रतिनिधि से नया लिंक भेजने के लिए कहें।',
    authorise: 'अधिकृत करें',
    authorisationSubmitted: 'अधिकृतिकरण जमा हो गया',
    submitFailed: 'आपका अधिकृतिकरण जमा नहीं हो सका। कृपया अपनी जानकारी जाँचकर पुनः प्रयास करें।',
    portalPassword: 'अपना पोर्टल पासवर्ड दर्ज करें',
    hidePassword: 'पासवर्ड छिपाएँ',
    showPassword: 'पासवर्ड दिखाएँ',
    termsReviewAt: 'आप Cred2Tech की उपयोग की शर्तें और गोपनीयता नीति यहाँ देख सकते हैं:',
    language: 'भाषा',

    consentPageTitle: 'Cred2Tech | डेटा सहमति',
    dataAccessConsent: 'डेटा एक्सेस की सहमति',
    consentIntro: ', Cred2Tech प्लेटफ़ॉर्म के माध्यम से, आपके ऋण की पात्रता का मूल्यांकन करने और उपयुक्त ऋण विकल्प खोजने के लिए निम्नलिखित जानकारी तक पहुँचने की आपकी सहमति माँग रहे हैं',
    consentFor: ' ({name} के लिए)',
    dataRequested: 'निम्नलिखित डेटा माँगा जाएगा',
    noDataUnlessApprove: 'जब तक आप इस अनुरोध को स्पष्ट रूप से स्वीकृत नहीं करते, कोई डेटा एक्सेस नहीं किया जाएगा। सहमति देने से पहले आप Cred2Tech की',
    termsAndPrivacy: 'उपयोग की शर्तें और गोपनीयता नीति',
    beforeConsent: 'देख सकते हैं।',
    agreeText: 'मैंने पढ़ और समझ लिया है कि कौन-सा डेटा माँगा जाएगा, और मैं ऋण के लिए अपनी पात्रता का आकलन करने हेतु {org}{person} को Cred2Tech के माध्यम से उपरोक्त जानकारी तक पहुँचने की सहमति देता/देती हूँ।',
    thisPlatform: 'इस प्लेटफ़ॉर्म',
    enterOtp: 'OTP दर्ज करें',
    otpSentTo: ' ({mobile} पर भेजा गया)',
    otpSentToYourMobile: ' (आपके मोबाइल नंबर पर भेजा गया)',
    sixDigitCode: '6 अंकों का कोड',
    resendOtp: 'OTP दोबारा भेजें',
    resendIn: 'दोबारा भेजें ({s} सेकंड)',
    sending: 'भेजा जा रहा है…',
    otpValid: 'कोड 10 मिनट तक मान्य है। नहीं मिला? "OTP दोबारा भेजें" दबाएँ।',
    submit: 'जमा करें',
    consentApproved: 'सहमति स्वीकृत',
    consentApprovedBody: 'धन्यवाद। आपकी सहमति दर्ज कर ली गई है और प्लेटफ़ॉर्म अब आपके ऋण आवेदन पर आगे बढ़ेगा। आप यह पृष्ठ बंद कर सकते हैं।',
    consentLinkInvalid: 'यह सहमति लिंक अमान्य है या इसकी समय-सीमा समाप्त हो चुकी है।',
    consentRecordFailed: 'आपकी सहमति दर्ज नहीं हो सकी। कृपया पुनः प्रयास करें।',
    resendFailed: 'OTP दोबारा नहीं भेजा जा सका। कृपया पुनः प्रयास करें।',
    otpResent: 'आपके मोबाइल नंबर पर नया OTP भेज दिया गया है।',
    dp_BUREAU: 'क्रेडिट ब्यूरो रिपोर्ट — आपका क्रेडिट इतिहास और संबंधित क्रेडिट जानकारी',
    dp_PAN: 'पैन विवरण — पैन से जुड़ी जानकारी जैसे नाम, जन्म तिथि और पैन से जुड़े जीएसटी पंजीकरण नंबर',
    dp_BANK: 'बैंक स्टेटमेंट डेटा — विश्लेषण के लिए दिए गए बैंक स्टेटमेंट में मौजूद खाते के लेन-देन, शेष राशि और अन्य जानकारी',

    itrPageTitle: 'Cred2Tech | ITR एक्सेस अधिकृत करें',
    itrHeading: 'ITR एक्सेस अधिकृत करें',
    itrIntro: '{who} ऋण आवेदन को आगे बढ़ाने के लिए आपके आयकर रिटर्न (ITR) फ़ाइलिंग डेटा तक पहुँच माँग रहे हैं। इसे सुरक्षित रूप से अधिकृत करने के लिए नीचे अपना आयकर ई-फ़ाइलिंग पैन/यूज़रनेम और पोर्टल पासवर्ड दर्ज करें।',
    itrNothingAccessed: 'जब तक आप स्वयं यह फ़ॉर्म जमा नहीं करते, आयकर पोर्टल से कुछ भी एक्सेस नहीं किया जाएगा।',
    panUsername: 'पैन / ITR यूज़रनेम',
    itrPassword: 'ITR पोर्टल पासवर्ड',
    itrPasswordNote: 'यह वही पासवर्ड है जिससे आप आयकर ई-फ़ाइलिंग पोर्टल में लॉगिन करते हैं — यह सीधे पोर्टल को भेजा जाता है और कभी संग्रहीत नहीं किया जाता।',
    itrSubmittedBody: 'धन्यवाद। आपका ITR पोर्टल एक्सेस जमा हो गया है और प्रोसेसिंग पूरी होने पर आपके प्रतिनिधि को सूचित किया जाएगा। आप यह पृष्ठ बंद कर सकते हैं।',
    itrWhat: 'ITR',

    gstPageTitle: 'Cred2Tech | GST एक्सेस अधिकृत करें',
    gstHeading: 'GST एक्सेस अधिकृत करें',
    gstIntro: 'ऋण आवेदन को आगे बढ़ाने के लिए{who} GSTIN {gstin} के GST फ़ाइलिंग डेटा तक पहुँच माँग रहे हैं। इसे सुरक्षित रूप से अधिकृत करने के लिए नीचे अपना GST पोर्टल यूज़रनेम और पासवर्ड दर्ज करें।',
    gstNothingAccessed: 'जब तक आप स्वयं यह फ़ॉर्म जमा नहीं करते, GST पोर्टल से कुछ भी एक्सेस नहीं किया जाएगा।',
    gstUsername: 'GST पोर्टल यूज़रनेम',
    gstUsernamePh: 'GST पोर्टल यूज़रनेम',
    gstPassword: 'GST पोर्टल पासवर्ड',
    gstPasswordNote: 'यह वही पासवर्ड है जिससे आप GST पोर्टल में लॉगिन करते हैं — यह सीधे पोर्टल को भेजा जाता है और कभी संग्रहीत नहीं किया जाता।',
    gstOtpNote: 'जमा करने के बाद, GST पोर्टल इस यूज़रनेम से पंजीकृत मोबाइल/ईमेल पर एक OTP भेजेगा — आप उसे अगले चरण में दर्ज करेंगे। यदि इस GSTIN पर OTP लॉगिन चालू नहीं है, तो अनुरोध विफल होगा और आपको पासवर्ड विकल्प चुनना होगा।',
    gstOtpFallback: '{message} यदि इस GSTIN के लिए OTP लॉगिन उपलब्ध नहीं है, तो नीचे पासवर्ड चुनें और पुनः प्रयास करें।',
    optPassword: 'पासवर्ड',
    optOtp: 'OTP',
    gstSubmittedBody: 'धन्यवाद। आपका GST पोर्टल एक्सेस जमा हो गया है और प्रोसेसिंग पूरी होने पर आपके प्रतिनिधि को सूचित किया जाएगा। आप यह पृष्ठ बंद कर सकते हैं।',
    gstWhat: 'GST',
    enterYourOtp: 'अपना OTP दर्ज करें',
    gstOtpSentBody: 'GST पोर्टल ने {gstin} के लिए पंजीकृत मोबाइल नंबर या ईमेल पर एक बार उपयोग होने वाला पासवर्ड भेजा है। अपना अधिकृतिकरण पूरा करने के लिए उसे नीचे दर्ज करें।',
    thisGstin: 'इस GSTIN',
    enterOtpPh: 'OTP दर्ज करें',
    submitOtp: 'OTP जमा करें',
    otpSubmitFailed: 'OTP जमा नहीं हो सका। कृपया कोड जाँचकर पुनः प्रयास करें।',
  },
};

const readStored = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'hi' || v === 'en' ? v : 'en';
  } catch {
    return 'en';
  }
};

/** Language state shared through localStorage so the choice survives a reload. */
export function useLang() {
  const [lang, setLangState] = useState(readStored);

  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private window: choice just isn't remembered */ }
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((key, vars) => {
    let s = DICT[lang][key] ?? DICT.en[key] ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.split(`{${k}}`).join(v ?? ''); });
    return s;
  }, [lang]);

  return { lang, setLang, t };
}

/** The server sends data-point labels as English text; map the known ones to the chosen language. */
export function translateDataPoint(label, t) {
  if (typeof label !== 'string') return label;
  const key = label.startsWith('Credit Bureau Report') ? 'dp_BUREAU'
    : label.startsWith('PAN Details') ? 'dp_PAN'
      : label.startsWith('Bank Statement Data') ? 'dp_BANK' : null;
  return key ? t(key) : label;
}

/** "Name from Org" in English, "Org के Name" in Hindi (the organisation comes first there). */
export function requesterLabel(name, org, lang, t) {
  const who = name || t('aRepresentative');
  if (!org) return who;
  return lang === 'hi' ? `${org} के ${who}` : `${who} from ${org}`;
}

export const LanguageSelect = ({ lang, setLang, t }) => (
  <div className="inline-flex items-center gap-1.5 text-[#0a1628] dark:text-[#e6edf7]">
    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">translate</span>
    <CustomSelect
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label={t('language')}
      style={{ minWidth: 104, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}
    >
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </CustomSelect>
  </div>
);
