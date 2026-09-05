/**
 * VIZITOR — Multilingual Support Engine (English, Hindi, Odia)
 * SIH 2026 / S157 — The ODRISCOLLS
 *
 * CRITICAL RULE:
 * Text changes with language, but Token numbers, queue positions,
 * waiting times, and server telemetry remain 100% IDENTICAL backend values.
 */

(function () {
    "use strict";

    const STORAGE_KEY = "vizitor_lang";

    const TRANSLATIONS = {
        en: {
            brandName: "VIZITOR",
            navDashboard: "Dashboard",
            navAppointments: "Appointments",
            navQueue: "Live Queue",
            navCrowd: "Crowd Status",
            navForecast: "Crowd Forecast",
            navHealthcare: "Healthcare 360",
            navHospitalMap: "Hospital Map",
            navAnalytics: "Analytics",
            navArcade: "Arcade & Wellness",
            navNotifications: "Notifications",
            navHelp: "Help Centre",
            navProfile: "Profile",
            navLogout: "Sign Out",

            // Headers & Common
            liveQueue: "Live Queue & Token Status",
            currentlyServing: "Now Serving",
            yourToken: "Your Token",
            peopleAhead: "People Ahead",
            estimatedWait: "Estimated Wait",
            crowdLevel: "Crowd Level",
            activePeople: "People Present",
            bookAppointment: "Book New Appointment",
            serviceName: "Service Name",
            selectDate: "Select Date",
            selectTime: "Select Time",
            priorityType: "Priority Level",
            priorityNormal: "Normal (FCFS)",
            priorityEmergency: "Emergency Priority",
            priorityVulnerable: "Senior / Vulnerable",
            cancel: "Cancel",
            confirmBooking: "Book Appointment",
            viewQR: "QR Pass",
            minutesUnit: "min",
            noCrowd: "No Crowd",
            lowCrowd: "Low",
            moderateCrowd: "Moderate",
            highCrowd: "High",
            criticalCrowd: "Critical",
            waiting: "Waiting",
            serving: "Being Served",
            served: "Served",

            // Help Center
            helpCenterTitle: "Help & Support Centre",
            helpCenterSubtitle: "Find answers, get guidance, and configure your companion settings.",
            faqTitle: "Frequently Asked Questions",
            faq1Q: "How does token numbering work in VIZITOR?",
            faq1A: "Token numbering begins strictly at A-114 for the current active schedule and increments sequentially (A-114, A-115, A-116...) ensuring fair first-come, first-served tracking.",
            faq2Q: "What is Emergency Priority booking?",
            faq2A: "Emergency and vulnerable patients can be designated with Emergency Priority, which expedites their consultation queue placement directly to the front while preserving standard order for general visits.",
            faq3Q: "Can a single patient book multiple tests or visits?",
            faq3A: "Yes! While multiple visits create individual queue tokens, VIZITOR's intelligent crowd deduplication ensures each patient is counted as exactly one physical person in the facility crowd density meter.",
            faq4Q: "Where do I view my Digital QR Pass?",
            faq4A: "Digital QR Passes can be viewed from either the Appointments tab or directly on the Live Queue page via the \"View QR Pass\" button.",

            // Vizi Helper & Robot
            viziHelperTitle: "Vizi Assistant",
            viziHelperDesc: "Let Vizi guide you around VIZITOR.",
            viziEnable: "Enable Vizi Assistant",
            viziSound: "Sound Effects",
            viziSoundDesc: "Play gentle audio cues for Vizi actions",
            viziFollowMe: "Hi! I'm Vizi! Follow me around!",
            viziOnboarding: "I'm always here to help you navigate!",
            viziMsgDashboard: "Welcome back! Where would you like to go today?",
            viziMsgAppointments: "Need an appointment? I can show you where to start.",
            viziMsgQueue: "Your place in the queue matters!",
            viziMsgCrowd: "Let's see how crowded it is.",
            viziMsgForecast: "Maybe we can find a quieter time.",
            viziMsgHealthcare: "Your health information is important.",
            viziMsgHospitalMap: "Lost? Let's find the right place.",
            viziMsgArcade: "Okay... five minutes of fun won't hurt 😏",
            viziMsgProfile: "Keeping your details updated helps!",
            viziMsgReports: "Let's see what the numbers say.",
            viziMsgHelp: "Ah, my favorite place!",
            viziMsgNotifications: "Stay on top of your queue updates!",
            viziMsgBookedSuccess: "Got it! Your appointment is booked!",
            viziMsgSuggestBooking: "Want to book your visit ahead of time?",
            viziMsgClick1: "Beep boop! How can I help?",
            viziMsgClick2: "Everything is running smoothly!",
            viziMsgClick3: "I'm monitoring the queue for you!"
        },
        hi: {
            brandName: "VIZITOR",
            navDashboard: "डैशबोर्ड",
            navAppointments: "अपॉइंटमेंट्स",
            navQueue: "लाइव कतार",
            navCrowd: "भीड़ की स्थिति",
            navForecast: "भीड़ पूर्वानुमान",
            navHealthcare: "स्वास्थ्य 360",
            navHospitalMap: "अस्पताल का नक्शा",
            navAnalytics: "विश्लेषण",
            navArcade: "आर्केड और स्वास्थ्य",
            navNotifications: "सूचनाएं",
            navHelp: "सहायता केंद्र",
            navProfile: "प्रोफ़ाइल",
            navLogout: "लॉग आउट",

            // Headers & Common
            liveQueue: "लाइव कतार और टोकन स्थिति",
            currentlyServing: "वर्तमान सेवा",
            yourToken: "आपका टोकन",
            peopleAhead: "आगे लोग",
            estimatedWait: "अनुमानित प्रतीक्षा",
            crowdLevel: "भीड़ का स्तर",
            activePeople: "उपस्थित लोग",
            bookAppointment: "नया अपॉइंटमेंट बुक करें",
            serviceName: "सेवा का नाम",
            selectDate: "तारीख चुनें",
            selectTime: "समय चुनें",
            priorityType: "प्राथमिकता स्तर",
            priorityNormal: "सामान्य (पहले आओ)",
            priorityEmergency: "आपातकालीन प्राथमिकता",
            priorityVulnerable: "वरिष्ठ / दिव्यांग",
            cancel: "रद्द करें",
            confirmBooking: "अपॉइंटमेंट बुक करें",
            viewQR: "क्यूआर पास",
            minutesUnit: "मिनट",
            noCrowd: "कोई भीड़ नहीं",
            lowCrowd: "कम भीड़",
            moderateCrowd: "मध्यम भीड़",
            highCrowd: "अधिक भीड़",
            criticalCrowd: "अत्यधिक भीड़",
            waiting: "प्रतीक्षारत",
            serving: "सेवा चालू है",
            served: "सेवा पूर्ण",

            // Help Center
            helpCenterTitle: "सहायता और सहायता केंद्र",
            helpCenterSubtitle: "उत्तर खोजें, मार्गदर्शन प्राप्त करें और अपने सहायक की सेटिंग्स कॉन्फ़िगर करें।",
            faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
            faq1Q: "VIZITOR में टोकन क्रमांकन कैसे काम करता है?",
            faq1A: "टोकन क्रमांकन वर्तमान सक्रिय अनुसूची के लिए सख्ती से A-114 से शुरू होता है और क्रमिक रूप से आगे बढ़ता है (A-114, A-115, A-116...) जिससे पहले-आओ-पहले-पाओ निष्पक्षता सुनिश्चित होती है।",
            faq2Q: "आपातकालीन प्राथमिकता बुकिंग क्या है?",
            faq2A: "आपातकालीन और संवेदनशील रोगियों को आपातकालीन प्राथमिकता दी जा सकती है, जिससे उनकी कतार सीधे आगे आ जाती है।",
            faq3Q: "क्या एक मरीज कई टेस्ट या विजिट बुक कर सकता है?",
            faq3A: "हाँ! प्रत्येक विजिट के लिए अलग टोकन बनता है, लेकिन VIZITOR की बुद्धिमान प्रणाली मरीज को भीड़ मीटर में ठीक 1 व्यक्ति के रूप में ही गिनती है।",
            faq4Q: "मैं अपना डिजिटल क्यूआर पास कहाँ देख सकता हूँ?",
            faq4A: "डिजिटल क्यूआर पास अपॉइंटमेंट्स टैब या लाइव कतार पेज पर 'क्यूआर पास देखें' बटन से देखा जा सकता है।",

            // Vizi Helper & Robot
            viziHelperTitle: "विज़ी सहायक",
            viziHelperDesc: "विज़ी को VIZITOR में आपका मार्गदर्शन करने दें।",
            viziEnable: "विज़ी सहायक सक्षम करें",
            viziSound: "ध्वनि प्रभाव",
            viziSoundDesc: "विज़ी की गतिविधियों के लिए मधुर ध्वनि बजाएं",
            viziFollowMe: "नमस्ते! मैं विज़ी हूँ! मेरे साथ चलें!",
            viziOnboarding: "मैं यहाँ हमेशा आपकी सहायता के लिए हूँ!",
            viziMsgDashboard: "वापसी पर स्वागत है! आज आप कहाँ जाना चाहेंगे?",
            viziMsgAppointments: "अपॉइंटमेंट चाहिए? मैं शुरुआत करने में मदद कर सकता हूँ।",
            viziMsgQueue: "कतार में आपका स्थान महत्वपूर्ण है!",
            viziMsgCrowd: "आइए देखें कि कितनी भीड़ है।",
            viziMsgForecast: "शायद हम एक शांत समय खोज सकें।",
            viziMsgHealthcare: "आपकी स्वास्थ्य जानकारी महत्वपूर्ण है।",
            viziMsgHospitalMap: "रास्ता भटक गए? आइए सही जगह खोजें।",
            viziMsgArcade: "ठीक है... पाँच मिनट का मज़ा बुरा नहीं होगा 😏",
            viziMsgProfile: "अपनी जानकारी अपडेट रखने से मदद मिलती है!",
            viziMsgReports: "आइए देखें कि आंकड़े क्या कहते हैं।",
            viziMsgHelp: "आह, मेरी पसंदीदा जगह!",
            viziMsgNotifications: "अपनी कतार की सूचनाओं से अवगत रहें!",
            viziMsgBookedSuccess: "हो गया! आपका अपॉइंटमेंट बुक हो गया है!",
            viziMsgSuggestBooking: "क्या आप पहले से अपना अपॉइंटमेंट बुक करना चाहते हैं?",
            viziMsgClick1: "बीप बूप! मैं कैसे मदद कर सकता हूँ?",
            viziMsgClick2: "सब कुछ सुचारू रूप से चल रहा है!",
            viziMsgClick3: "मैं आपके लिए कतार की निगरानी कर रहा हूँ!"
        },
        or: {
            brandName: "VIZITOR",
            navDashboard: "ଡ୍ୟାସବୋର୍ଡ",
            navAppointments: "ଆପଏଣ୍ଟମେଣ୍ଟ",
            navQueue: "ଲାଇଭ ଧାଡ଼ି",
            navCrowd: "ଭିଡ଼ ସ୍ଥିତି",
            navForecast: "ଭିଡ଼ ପୂର୍ବାନୁମାନ",
            navHealthcare: "ସ୍ୱାସ୍ଥ୍ୟସେବା ୩୬୦",
            navHospitalMap: "ଡାକ୍ତରଖାନା ମାନଚିତ୍ର",
            navAnalytics: "ବିଶ୍ଳେଷଣ",
            navArcade: "ଆର୍କେଡ ଓ ସ୍ୱାସ୍ଥ୍ୟ",
            navNotifications: "ବାର୍ତ୍ତା",
            navHelp: "ସହାୟତା କେନ୍ଦ୍ର",
            navProfile: "ପ୍ରୋଫାଇଲ୍",
            navLogout: "ଲଗ୍ ଆଉଟ୍",

            // Headers & Common
            liveQueue: "ଲାଇଭ ଧାଡ଼ି ଓ ଟୋକନ୍ ସ୍ଥିତି",
            currentlyServing: "ବର୍ତ୍ତମାନ ସେବା",
            yourToken: "ଆପଣଙ୍କ ଟୋକନ୍",
            peopleAhead: "ଆଗରେ ଥିବା ଲୋକ",
            estimatedWait: "ଆନୁମାନିକ ଅପେକ୍ଷା",
            crowdLevel: "ଭିଡ଼ ସ୍ତର",
            activePeople: "ଉପସ୍ଥିତ ଲୋକ",
            bookAppointment: "ନୂତନ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ",
            serviceName: "ସେବା ନାମ",
            selectDate: "ତାରିଖ ବାଛନ୍ତୁ",
            selectTime: "ସମୟ ବାଛନ୍ତୁ",
            priorityType: "ପ୍ରାଥମିକତା ସ୍ତର",
            priorityNormal: "ସାଧାରଣ",
            priorityEmergency: "ଜରୁରୀକାଳୀନ",
            priorityVulnerable: "ବରିଷ୍ଠ ନାଗରିକ",
            cancel: "ବାତିଲ୍",
            confirmBooking: "ବୁକ୍ କରନ୍ତୁ",
            viewQR: "କ୍ୟୁଆର୍ ପାସ୍",
            minutesUnit: "ମିନିଟ୍",
            noCrowd: "ଭିଡ଼ ନାହିଁ",
            lowCrowd: "କମ୍ ଭିଡ଼",
            moderateCrowd: "ମଧ୍ୟମ ଭିଡ଼",
            highCrowd: "ଅଧିକ ଭିଡ଼",
            criticalCrowd: "ଅତ୍ୟଧିକ ଭିଡ଼",
            waiting: "ଅପେକ୍ଷାରତ",
            serving: "ସେବା ଚାଲୁଅଛି",
            served: "ସେବା ସମାପ୍ତ",

            // Help Center
            helpCenterTitle: "ସହାୟତା ଓ ସମର୍ଥନ କେନ୍ଦ୍ର",
            helpCenterSubtitle: "ଉତ୍ତର ଖୋଜନ୍ତୁ, ମାର୍ଗଦର୍ଶନ ପାଆନ୍ତୁ ଏବଂ ଆପଣଙ୍କ ସହାୟକ ସେଟିଂସ୍ ବିନ୍ୟାସ କରନ୍ତୁ।",
            faqTitle: "ବାରମ୍ବାର ପଚରାଯାଉଥିବା ପ୍ରଶ୍ନ",
            faq1Q: "VIZITOR ରେ ଟୋକନ୍ କ୍ରମାଙ୍କନ କିପରି କାମ କରେ?",
            faq1A: "ଟୋକନ୍ କ୍ରମାଙ୍କନ ବର୍ତ୍ତମାନର ସକ୍ରିୟ କାର୍ଯ୍ୟସୂଚୀ ପାଇଁ A-114 ରୁ ଆରମ୍ଭ ହୋଇ କ୍ରମାଗତ ଭାବେ (A-114, A-115, A-116...) ବୃଦ୍ଧି ପାଏ।",
            faq2Q: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା ବୁକିଂ କ’ଣ?",
            faq2A: "ଜରୁରୀକାଳୀନ ଏବଂ ଅସୁରକ୍ଷିତ ରୋଗୀଙ୍କୁ ପ୍ରାଥମିକତା ଦିଆଯାଏ, ଯାହା ସେମାନଙ୍କ ଧାଡ଼ିକୁ ସିଧାସଳଖ ଆଗକୁ ଆଣିଥାଏ।",
            faq3Q: "ଜଣେ ରୋଗୀ ଏକାଧିକ ପରୀକ୍ଷା ବୁକ୍ କରିପାରିବେ କି?",
            faq3A: "ହଁ! ପ୍ରତ୍ୟେକ ଭ୍ରମଣ ପାଇଁ ଅଲଗା ଟୋକନ୍ ସୃଷ୍ଟି ହୁଏ, କିନ୍ତୁ ଭିଡ଼ ଗଣନାରେ ରୋଗୀଙ୍କୁ କେବଳ ଜଣେ ବ୍ୟକ୍ତି ଭାବେ ଗଣନା କରାଯାଏ।",
            faq4Q: "ମୁଁ ମୋର ଡିଜିଟାଲ୍ QR ପାସ୍ କେଉଁଠାରେ ଦେଖିବି?",
            faq4A: "ଆପଏଣ୍ଟମେଣ୍ଟ ଟ୍ୟାବ୍ କିମ୍ବା ଲାଇଭ ଧାଡ଼ି ପୃଷ୍ଠାର 'QR ପାସ୍ ଦେଖନ୍ତୁ' ବଟନ୍ ମାଧ୍ୟମରେ QR ପାସ୍ ଦେଖାଯାଇପାରିବ।",

            // Vizi Helper & Robot
            viziHelperTitle: "ଭିଜି ସହାୟକ",
            viziHelperDesc: "ଭିଜିକୁ VIZITOR ରେ ଆପଣଙ୍କୁ ମାର୍ଗଦର୍ଶନ କରିବାକୁ ଦିଅନ୍ତୁ।",
            viziEnable: "ଭିଜି ସହାୟକ ସକ୍ରିୟ କରନ୍ତୁ",
            viziSound: "ଧ୍ୱନି ପ୍ରଭାବ",
            viziSoundDesc: "ଭିଜିର କାର୍ଯ୍ୟ ପାଇଁ କୋମଳ ଧ୍ୱନି ବଜାନ୍ତୁ",
            viziFollowMe: "ନମସ୍କାର! ମୁଁ ଭିଜି! ମୋ ସହିତ ଆସନ୍ତୁ!",
            viziOnboarding: "ମୁଁ ସର୍ବଦା ଆପଣଙ୍କ ସହାୟତା ପାଇଁ ଏଠାରେ ଅଛି!",
            viziMsgDashboard: "ସ୍ୱାଗତ! ଆଜି ଆପଣ କେଉଁଠାକୁ ଯିବାକୁ ଚାହାଁନ୍ତି?",
            viziMsgAppointments: "ଆପଏଣ୍ଟମେଣ୍ଟ ଆବଶ୍ୟକ କି? ମୁଁ ଆପଣଙ୍କୁ ଦେଖାଇପାରିବି।",
            viziMsgQueue: "ଧାଡ଼ିରେ ଆପଣଙ୍କ ସ୍ଥାନ ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ!",
            viziMsgCrowd: "ଆସନ୍ତୁ ଦେଖିବା କେତେ ଭିଡ଼ ଅଛି।",
            viziMsgForecast: "ହୁଏତ ଆମେ ଏକ କମ୍ ଭିଡ଼ ସମୟ ଖୋଜିପାରିବା।",
            viziMsgHealthcare: "ଆପଣଙ୍କ ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା ଗୁରୁତ୍ୱପୂର୍ଣ୍ଣ।",
            viziMsgHospitalMap: "ଆସନ୍ତୁ ସଠିକ୍ ସ୍ଥାନ ଖୋଜିବା।",
            viziMsgArcade: "ଠିକ୍ ଅଛି... ପାଞ୍ଚ ମିନିଟ୍ ଖେଳିଲେ କିଛି କ୍ଷତି ନାହିଁ 😏",
            viziMsgProfile: "ଆପଣଙ୍କ ବିବରଣୀ ଅଦ୍ୟତନ ରଖିବା ସାହାଯ୍ୟ କରେ!",
            viziMsgReports: "ଆସନ୍ତୁ ଦେଖିବା ସଂଖ୍ୟାଗୁଡ଼ିକ କ’ଣ କହୁଛି।",
            viziMsgHelp: "ଆହା, ମୋର ପ୍ରିୟ ସ୍ଥାନ!",
            viziMsgNotifications: "ଆପଣଙ୍କ ଧାଡ଼ି ସୂଚନା ସହିତ ଅଦ୍ୟତନ ରୁହନ୍ତୁ!",
            viziMsgBookedSuccess: "ହୋଇଗଲା! ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ ହୋଇଗଲା!",
            viziMsgSuggestBooking: "ଆପଣ ପୂର୍ବରୁ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରିବାକୁ ଚାହାଁନ୍ତି କି?",
            viziMsgClick1: "ବିପ୍ ବୁପ୍! ମୁଁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
            viziMsgClick2: "ସବୁକିଛି ସୁରୁଖୁରୁରେ ଚାଲିଛି!",
            viziMsgClick3: "ମୁଁ ଆପଣଙ୍କ ପାଇଁ ଧାଡ଼ିର ଯାଞ୍ଚ କରୁଛି!"
        }
    };

    // Deep text dictionary for DOM-wide real content translation
    const PHRASE_MAP = {
        // Healthcare Network Translations
        "Facilities & Routing": { hi: "सुविधाएं और रूटिंग", or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ଓ ରୁଟିଂ" },
        "Facility Discovery & Crowd-Aware Routing": { hi: "सुविधा खोज और भीड़-जागरूक रूटिंग", or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ସନ୍ଧାନ ଓ ଭିଡ଼-ଅନୁକୂଳ ରୁଟିଂ" },
        "Facility Discovery": { hi: "सुविधा खोज", or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ସନ୍ଧାନ" },
        "Specialists & OPD": { hi: "विशेषज्ञ और ओपीडी", or: "ବିଶେଷଜ୍ଞ ଓ ଓପିଡି" },
        "Specialists": { hi: "विशेषज्ञ", or: "ବିଶେଷଜ୍ଞ" },
        "Diagnostics & Lab": { hi: "निदान और प्रयोगशाला", or: "ନିଦାନ ଓ ଲାବୋରେଟୋରୀ" },
        "Diagnostics": { hi: "निदान", or: "ନିଦାନ" },
        "Medicines & Inventory": { hi: "दवाएं और इन्वेंट्री", or: "ଔଷଧ ଓ ଭଣ୍ଡାର" },
        "Medicines": { hi: "दवाएं", or: "ଔଷଧ" },
        "Referral Tracking": { hi: "रेफरल ट्रैकिंग", or: "ରେଫରାଲ୍ ଟ୍ରାକିଂ" },
        "Referrals": { hi: "रेफरल", or: "ରେଫରାଲ୍" },
        "Patient 360": { hi: "रोगी 360", or: "ରୋଗୀ ୩୬୦" },
        "Intelligent clinical requirement matching, priority ranking, and real-time operational telemetry": { hi: "बुद्धिमान नैदानिक आवश्यकता मिलान, प्राथमिकता रैंकिंग, और वास्तविक समय परिचालन टेलीमेट्री", or: "ବୁଦ୍ଧିମାନ ଚିକିତ୍ସା ଆବଶ୍ୟକତା ମେଳ, ପ୍ରାଥମିକତା କ୍ରମ ଏବଂ ପ୍ରକୃତ ସମୟ କାର୍ଯ୍ୟକ୍ଷମତା ଟେଲିମେଟ୍ରି" },
        "Specialist Availability & OPD Schedule": { hi: "विशेषज्ञ उपलब्धता और ओपीडी अनुसूची", or: "ବିଶେଷଜ୍ଞ ଉପଲବ୍ଧତା ଓ ଓପିଡି କାର୍ଯ୍ୟସୂଚୀ" },
        "Diagnostic Test Catalog & Queue": { hi: "नैदानिक परीक्षण सूची और कतार", or: "ନିଦାନ ପରୀକ୍ଷା ତାଲିକା ଓ ଧାଡ଼ି" },
        "Medicines & Pharmacy Inventory": { hi: "दवाएं और फार्मेसी इन्वेंट्री", or: "ଔଷଧ ଓ ଫାର୍ମାସୀ ଭଣ୍ଡାର" },
        "Inter-Facility Patient Referral Tracking": { hi: "अंतर-सुविधा रोगी रेफरल ट्रैकिंग", or: "ଡାକ୍ତରଖାନା ମଧ୍ୟରେ ରୋଗୀ ସ୍ଥାନାନ୍ତର ଟ୍ରାକିଂ" },
        "Cardiology": { hi: "हृदय रोग विज्ञान (कार्डियोलॉजी)", or: "ହୃଦରୋଗ ବିଜ୍ଞାନ (କାର୍ଡିଓଲୋଜି)" },
        "Pediatrics": { hi: "बाल चिकित्सा (पीडियाट्रिक्स)", or: "ଶିଶୁରୋଗ ଚିକିତ୍ସା (ପିଡିଆଟ୍ରିକ୍ସ)" },
        "Orthopedics": { hi: "अस्थि रोग विज्ञान (ऑर्थोपेडिक्स)", or: "ଅସ୍ଥିଶଲ୍ୟ ଚିକିତ୍ସା (ଅର୍ଥୋପେଡିକ୍ସ)" },
        "Gynecology": { hi: "स्त्री रोग विज्ञान (गाइनेकोलॉजी)", or: "ସ୍ତ୍ରୀରୋଗ ଚିକିତ୍ସା (ଗାଇନେକୋଲୋଜି)" },
        "General Medicine": { hi: "सामान्य चिकित्सा", or: "ସାଧାରଣ ଚିକିତ୍ସା" },
        "Neurology": { hi: "तंत्रिका विज्ञान (न्यूरोलॉजी)", or: "ସ୍ନାୟୁରୋଗ ବିଜ୍ଞାନ (ନ୍ୟୁରୋଲୋଜି)" },
        "Available": { hi: "उपलब्ध", or: "ଉପଲବ୍ଧ" },
        "Unavailable": { hi: "अनुपलब्ध", or: "ଅନୁପଲବ୍ଧ" },
        "On Leave": { hi: "छुट्टी पर", or: "ଛୁଟିରେ" },
        "Busy": { hi: "व्यस्त", or: "ବ୍ୟସ୍ତ" },
        "In Stock": { hi: "स्टॉक में उपलब्ध", or: "ଭଣ୍ଡାରରେ ଉପଲବ୍ଧ" },
        "Out of Stock": { hi: "स्टॉक समाप्त", or: "ଭଣ୍ଡାର ଶେଷ" },
        "District Hospital": { hi: "जिला अस्पताल", or: "ଜିଲ୍ଲା ମୁଖ୍ୟ ଚିକିତ୍ସାଳୟ" },
        "Community Health Centre": { hi: "सामुदायिक स्वास्थ्य केंद्र", or: "ଗୋଷ୍ଠୀ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର" },
        "Primary Health Centre": { hi: "प्राथमिक स्वास्थ्य केंद्र", or: "ପ୍ରାଥମିକ ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର" },
        "Sub-Centre": { hi: "उप-स्वास्थ्य केंद्र", or: "ଉପ-ସ୍ୱାସ୍ଥ୍ୟ କେନ୍ଦ୍ର" },
        "Online": { hi: "ऑनलाइन", or: "ଅନଲାଇନ୍" },
        "Offline": { hi: "ऑफ़लाइन", or: "ଅଫଲାଇନ୍" },
        "Limited": { hi: "सीमित", or: "ସୀମିତ" },
        "Pending Sync": { hi: "सिंक लंबित", or: "ସିଙ୍କ ବାକି ଅଛି" },
        "Cached / Offline Data": { hi: "कैश्ड / ऑफ़लाइन डेटा", or: "କ୍ୟାସ୍ / ଅଫଲାଇନ୍ ତଥ୍ୟ" },
        "Help & Support Centre": { hi: "सहायता और सहायता केंद्र", or: "ସହାୟତା ଓ ସମର୍ଥନ କେନ୍ଦ୍ର" },
        "Find answers, get guidance, and configure your companion settings.": { hi: "उत्तर खोजें, मार्गदर्शन प्राप्त करें और अपने सहायक की सेटिंग्स कॉन्फ़िगर करें।", or: "ଉତ୍ତର ଖୋଜନ୍ତୁ, ମାର୍ଗଦର୍ଶନ ପାଆନ୍ତୁ ଏବଂ ଆପଣଙ୍କ ସହାୟକ ସେଟିଂସ୍ ବିନ୍ୟାସ କରନ୍ତୁ।" },
        "Frequently Asked Questions": { hi: "अक्सर पूछे जाने वाले प्रश्न", or: "ବାରମ୍ବାର ପଚରାଯାଉଥିବା ପ୍ରଶ୍ନ" },
        "How does token numbering work in VIZITOR?": { hi: "VIZITOR में टोकन क्रमांकन कैसे काम करता है?", or: "VIZITOR ରେ ଟୋକନ୍ କ୍ରମାଙ୍କନ କିପରି କାମ କରେ?" },
        "What is Emergency Priority booking?": { hi: "आपातकालीन प्राथमिकता बुकिंग क्या है?", or: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା ବୁକିଂ କ’ଣ?" },
        "Can a single patient book multiple tests or visits?": { hi: "क्या एक मरीज कई टेस्ट या विजिट बुक कर सकता है?", or: "ଜଣେ ରୋଗୀ ଏକାଧିକ ପରୀକ୍ଷା ବୁକ୍ କରିପାରିବେ କି?" },
        "Where do I view my Digital QR Pass?": { hi: "मैं अपना डिजिटल क्यूआर पास कहाँ देख सकता हूँ?", or: "ମୁଁ ମୋର ଡିଜିଟାଲ୍ QR ପାସ୍ କେଉଁଠାରେ ଦେଖିବି?" },
        "Say Hello to Vizi": { hi: "विज़ी को नमस्ते कहें", or: "ଭିଜିକୁ ନମସ୍କାର କୁହନ୍ତୁ" },
        "Enable Vizi Assistant": { hi: "विज़ी सहायक सक्षम करें", or: "ଭିଜି ସହାୟକ ସକ୍ରିୟ କରନ୍ତୁ" },
        "Sound Effects": { hi: "ध्वनि प्रभाव", or: "ଧ୍ୱନି ପ୍ରଭାବ" },
        "Play gentle audio cues for Vizi actions": { hi: "विज़ी की गतिविधियों के लिए मधुर ध्वनि बजाएं", or: "ଭିଜିର କାର୍ଯ୍ୟ ପାଇଁ କୋମଳ ଧ୍ୱନି ବଜାନ୍ତୁ" },
        "Show the interactive assistant robot on your screen": { hi: "अपनी स्क्रीन पर संवादात्मक सहायक रोबोट दिखाएं", or: "ଆପଣଙ୍କ ସ୍କ୍ରିନରେ ସହାୟକ ରୋବୋଟ୍ ଦେଖାନ୍ତୁ" },
        "Let Vizi guide you around VIZITOR.": { hi: "विज़ी को VIZITOR में आपका मार्गदर्शन करने दें।", or: "ଭିଜିକୁ VIZITOR ରେ ଆପଣଙ୍କୁ ମାର୍ଗଦର୍ଶନ କରିବାକୁ ଦିଅନ୍ତୁ।" },
        "Book New Appointment": { hi: "नया अपॉइंटमेंट बुक करें", or: "ନୂତନ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ" },
        "Book Appointment": { hi: "अपॉइंटमेंट बुक करें", or: "ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ" },
        "Appointments": { hi: "अपॉइंटमेंट्स", or: "ଆପଏଣ୍ଟମେଣ୍ଟ" },
        "Live Queue": { hi: "लाइव कतार", or: "ଲାଇଭ ଧାଡ଼ି" },
        "Live Queue & Token Status": { hi: "लाइव कतार और टोकन स्थिति", or: "ଲାଇଭ ଧାଡ଼ି ଓ ଟୋକନ୍ ସ୍ଥିତି" },
        "Crowd Status": { hi: "भीड़ की स्थिति", or: "ଭିଡ଼ ସ୍ଥିତି" },
        "Crowd Forecast": { hi: "भीड़ पूर्वानुमान", or: "ଭିଡ଼ ପୂର୍ବାନୁମାନ" },
        "Healthcare 360": { hi: "स्वास्थ्य 360", or: "ସ୍ୱାସ୍ଥ୍ୟସେବା ୩୬୦" },
        "Hospital Map": { hi: "अस्पताल का नक्शा", or: "ଡାକ୍ତରଖାନା ମାନଚିତ୍ର" },
        "Hospital Location": { hi: "अस्पताल का स्थान", or: "ଡାକ୍ତରଖାନାର ସ୍ଥାନ" },
        "Find a nearby hospital and view its location.": { hi: "पास का अस्पताल खोजें और उसका स्थान देखें।", or: "ନିକଟସ୍ଥ ଡାକ୍ତରଖାନା ଖୋଜନ୍ତୁ ଏବଂ ଏହାର ସ୍ଥାନ ଦେଖନ୍ତୁ।" },
        "← Back to Dashboard": { hi: "← डैशबोर्ड पर वापस", or: "← ଡ୍ୟାସବୋର୍ଡକୁ ଫେରନ୍ତୁ" },
        "Arcade & Wellness": { hi: "आर्केड और स्वास्थ्य", or: "ଆର୍କେଡ ଓ ସ୍ୱାସ୍ଥ୍ୟ" },
        "Analytics": { hi: "विश्लेषण", or: "ବିଶ୍ଳେଷଣ" },
        "Notifications": { hi: "सूचनाएं", or: "ବାର୍ତ୍ତା" },
        "Help Centre": { hi: "सहायता केंद्र", or: "ସହାୟତା କେନ୍ଦ୍ର" },
        "Profile": { hi: "प्रोफ़ाइल", or: "ପ୍ରୋଫାଇଲ୍" },
        "Logout": { hi: "लॉग आउट", or: "ଲଗ୍ ଆଉଟ୍" },
        "Sign Out": { hi: "लॉग आउट", or: "ଲଗ୍ ଆଉଟ୍" },
        "Now Serving": { hi: "वर्तमान सेवा", or: "ବର୍ତ୍ତମାନ ସେବା" },
        "Your Token": { hi: "आपका टोकन", or: "ଆପଣଙ୍କ ଟୋକନ୍" },
        "YOUR TOKEN": { hi: "आपका टोकन", or: "ଆପଣଙ୍କ ଟୋକନ୍" },
        "People Ahead": { hi: "आगे लोग", or: "ଆଗରେ ଥିବା ଲୋକ" },
        "Estimated Wait": { hi: "अनुमानित प्रतीक्षा", or: "ଆନୁମାନିକ ଅପେକ୍ଷା" },
        "Active Counters": { hi: "सक्रिय काउंटर", or: "ସକ୍ରିୟ କାଉଣ୍ଟର" },
        "Facility average wait": { hi: "सुविधा का औसत प्रतीक्षा समय", or: "ସୁବିଧାର ହାରାହାରି ଅପେକ୍ଷା ସମୟ" },
        "Counters open right now": { hi: "अभी खुले काउंटर", or: "ବର୍ତ୍ତମାନ ଖୋଲାଥିବା କାଉଣ୍ଟର" },
        "Service Rate": { hi: "सेवा दर", or: "ସେବା ହାର" },
        "Average Wait Time": { hi: "औसत प्रतीक्षा समय", or: "ହାରାହାରି ଅପେକ୍ଷା ସମୟ" },
        "Overview": { hi: "अवलोकन", or: "ସମୀକ୍ଷା" },
        "Reports": { hi: "रिपोर्ट्स", or: "ରିପୋର୍ଟ" },
        "Crowd Prediction Trend": { hi: "भीड़ पूर्वानुमान रुझान", or: "ଭିଡ଼ ପୂର୍ବାନୁମାନ ଧାରା" },
        "Forecast Duration Window": { hi: "पूर्वानुमान समयावधि", or: "ପୂର୍ବାନୁମାନ ସମୟ ୱିଣ୍ଡୋ" },
        "Select time horizon for predictive crowd projections.": { hi: "अनुमानित भीड़ के लिए समय सीमा चुनें।", or: "ପୂର୍ବାନୁମାନ ଭିଡ଼ ପାଇଁ ସମୟ ସୀମା ବାଛନ୍ତୁ।" },
        "Expected Peak Period": { hi: "अपेक्षित व्यस्त समय", or: "ଅପେକ୍ଷିତ ବ୍ୟସ୍ତ ସମୟ" },
        "Recommended Time to Visit": { hi: "भेंट के लिए अनुशंसित समय", or: "ପରିଦର୍ଶନ ପାଇଁ ସୁପାରିଶ ସମୟ" },
        "AI System Recommendation": { hi: "एआई प्रणाली सिफारिश", or: "ଏଆଇ ପ୍ରଣାଳୀ ସୁପାରିଶ" },
        "Live Telemetry": { hi: "लाइव टेलीमेट्री", or: "ଲାଇଭ୍ ଟେଲିମେଟ୍ରି" },
        "Refresh": { hi: "रिफ्रेश", or: "ରିଫ୍ରେଶ୍" },
        "Refresh Status": { hi: "स्थिति ताज़ा करें", or: "ସ୍ଥିତି ଅଦ୍ୟତନ କରନ୍ତୁ" },
        "Simulate Crowd (+5)": { hi: "भीड़ अनुकरण (+5)", or: "ଭିଡ଼ ଅନୁକରଣ (+5)" },
        "Simulate Crowd (+10)": { hi: "भीड़ अनुकरण (+10)", or: "ଭିଡ଼ ଅନୁକରଣ (+10)" },
        "Simulate Crowd (+20)": { hi: "भीड़ अनुकरण (+20)", or: "ଭିଡ଼ ଅନୁକରଣ (+20)" },
        "Simulate Crowd (+50)": { hi: "भीड़ अनुकरण (+50)", or: "ଭିଡ଼ ଅନୁକରଣ (+50)" },
        "Simulate Crowd": { hi: "भीड़ अनुकरण", or: "ଭିଡ଼ ଅନୁକରଣ" },
        "Done": { hi: "पूर्ण", or: "ସମାପ୍ତ" },
        "Cancel": { hi: "रद्द करें", or: "ବାତିଲ୍" },
        "Try Again": { hi: "पुनः प्रयास करें", or: "ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ" },
        "View QR Pass": { hi: "क्यूआर पास देखें", or: "QR ପାସ୍ ଦେଖନ୍ତୁ" },
        "Appointment Confirmed": { hi: "अपॉइंटमेंट की पुष्टि हो गई", or: "ଆପଏଣ୍ଟମେଣ୍ଟ ନିଶ୍ଚିତ ହେଲା" },
        "Your appointment has been successfully booked.": { hi: "आपका अपॉइंटमेंट सफलतापूर्वक बुक हो गया है।", or: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବୁକ୍ ହୋଇଗଲା।" },
        "Appointment Cancelled": { hi: "अपॉइंटमेंट रद्द किया गया", or: "ଆପଏଣ୍ଟମେଣ୍ଟ ବାତିଲ୍ ହେଲା" },
        "Your appointment has been successfully cancelled.": { hi: "आपका अपॉइंटमेंट सफलतापूर्वक रद्द कर दिया गया है।", or: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବାତିଲ୍ କରାଗଲା।" },
        "Service": { hi: "सेवा", or: "ସେବା" },
        "Date": { hi: "तारीख", or: "ତାରିଖ" },
        "Time": { hi: "समय", or: "ସମୟ" },
        "Queue Position": { hi: "कतार स्थान", or: "ଧାଡ଼ି ସ୍ଥାନ" },
        "Status": { hi: "स्थिति", or: "ସ୍ଥିତି" },
        "Patient Name": { hi: "रोगी का नाम", or: "ରୋଗୀଙ୍କ ନାମ" },
        "Phone Number": { hi: "फ़ोन नंबर", or: "ଫୋନ୍ ନମ୍ବର" },
        "Email Address": { hi: "ईमेल पता", or: "ଇମେଲ୍ ଠିକଣା" },
        "Emergency Priority": { hi: "आपातकालीन प्राथमिकता", or: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା" },
        "Select Service": { hi: "सेवा चुनें", or: "ସେବା ବାଛନ୍ତୁ" },
        "General Consultation": { hi: "सामान्य परामर्श", or: "ସାଧାରଣ ପରାମର୍ଶ" },
        "Document Verification": { hi: "दस्तावेज़ सत्यापन", or: "ଦଲିଲ ଯାଞ୍ଚ" },
        "Health Screening": { hi: "स्वास्थ्य जांच", or: "ସ୍ୱାସ୍ଥ୍ୟ ପରୀକ୍ଷା" },
        "ID & License Services": { hi: "पहचान और लाइसेंस सेवाएं", or: "ପରିଚୟ ଓ ଲାଇସେନ୍ସ ସେବା" },
        "No Crowd": { hi: "कोई भीड़ नहीं", or: "ଭିଡ଼ ନାହିଁ" },
        "Low": { hi: "कम", or: "କମ୍" },
        "Moderate": { hi: "मध्यम", or: "ମଧ୍ୟମ" },
        "High": { hi: "अधिक", or: "ଅଧିକ" },
        "Critical": { hi: "अत्यधिक", or: "ଅତ୍ୟଧିକ" },
        "Active": { hi: "सक्रिय", or: "ସକ୍ରିୟ" },
        "Completed": { hi: "पूर्ण", or: "ସମାପ୍ତ" },
        "Cancelled": { hi: "रद्द", or: "ବାତିଲ୍" },
        "Waiting": { hi: "प्रतीक्षारत", or: "ଅପେକ୍ଷାରତ" }
    };

    function getCurrentLang() {
        return localStorage.getItem(STORAGE_KEY) || "en";
    }

    function setLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = "en";
        localStorage.setItem(STORAGE_KEY, lang);
        applyTranslations();
        window.dispatchEvent(new CustomEvent("vizitorLanguageChanged", { detail: { lang } }));
    }

    function t(key) {
        const lang = getCurrentLang();
        return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || (TRANSLATIONS.en && TRANSLATIONS.en[key]) || key;
    }

    function applyTranslations() {
        const lang = getCurrentLang();
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

        // 1. Elements explicitly marked with data-i18n
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (dict[key]) {
                el.textContent = dict[key];
            }
        });

        // 2. Sidebar Menu items
        const menuLinks = {
            "dashboard.html": dict.navDashboard,
            "appointments.html": dict.navAppointments,
            "queue.html": dict.navQueue,
            "crowd.html": dict.navCrowd,
            "crowd-forecast.html": dict.navForecast,
            "healthcare.html": dict.navHealthcare,
            "hospital-map.html": dict.navHospitalMap,
            "analytics.html": dict.navAnalytics,
            "arcade.html": dict.navArcade,
            "notifications.html": dict.navNotifications,
            "help.html": dict.navHelp,
            "profile.html": dict.navProfile,
        };

        document.querySelectorAll(".sidebar-menu .menu-item").forEach(a => {
            const href = a.getAttribute("href");
            const span = a.querySelector("span");
            if (span && href && menuLinks[href]) {
                span.textContent = menuLinks[href];
            }
        });

        // 3. Deep DOM scanner for entire page text nodes
        if (lang === "en") {
            // Restore original English text
            document.querySelectorAll("[data-v-orig]").forEach(el => {
                el.textContent = el.getAttribute("data-v-orig");
            });
            document.querySelectorAll("[data-v-orig-ph]").forEach(el => {
                el.placeholder = el.getAttribute("data-v-orig-ph");
            });
        } else {
            // Scan text-holding elements
            const candidates = document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, strong, button, label, th, td, a, .forecast-stat-label, .forecast-stat-sub, .peak-card-title, .peak-card-desc, .panel-title");
            candidates.forEach(el => {
                // Ignore elements with children or code tags or inputs
                if (el.children.length > 0) return;
                const raw = (el.getAttribute("data-v-orig") || el.textContent).trim();
                if (!raw) return;

                if (PHRASE_MAP[raw] && PHRASE_MAP[raw][lang]) {
                    if (!el.getAttribute("data-v-orig")) {
                        el.setAttribute("data-v-orig", raw);
                    }
                    el.textContent = PHRASE_MAP[raw][lang];
                }
            });

            // Input placeholders
            document.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(el => {
                const raw = (el.getAttribute("data-v-orig-ph") || el.placeholder).trim();
                if (PHRASE_MAP[raw] && PHRASE_MAP[raw][lang]) {
                    if (!el.getAttribute("data-v-orig-ph")) {
                        el.setAttribute("data-v-orig-ph", raw);
                    }
                    el.placeholder = PHRASE_MAP[raw][lang];
                }
            });
        }

        // 4. Update language switcher dropdown selection
        const select = document.getElementById("vizitorLangSelect");
        if (select) {
            select.value = lang;
        }
    }

    function injectLanguageSwitcher() {
        if (document.getElementById("vizitorLangSwitcher")) return;

        const currentLang = getCurrentLang();
        const container = document.createElement("div");
        container.id = "vizitorLangSwitcher";
        container.style.cssText = "display:inline-flex;align-items:center;margin-left:auto;margin-right:1rem;gap:0.4rem;font-size:0.85rem;font-weight:600;";

        container.innerHTML = `
            <span style="color:#64748b;display:inline-flex;align-items:center;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                Lang:
            </span>
            <select id="vizitorLangSelect" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:3px 8px;font-size:0.85rem;color:#1e293b;cursor:pointer;font-weight:600;outline:none;">
                <option value="en" ${currentLang === "en" ? "selected" : ""}>English</option>
                <option value="hi" ${currentLang === "hi" ? "selected" : ""}>हिंदी (Hindi)</option>
                <option value="or" ${currentLang === "or" ? "selected" : ""}>ଓଡ଼ିଆ (Odia)</option>
            </select>
        `;

        // Try mounting inside .topbar, .user-nav, .dashboard-header, or body
        const mountTarget =
            document.querySelector(".topbar-right") ||
            document.querySelector(".topbar") ||
            document.querySelector(".user-nav") ||
            document.querySelector(".header-right") ||
            document.querySelector(".dashboard-header");

        if (mountTarget) {
            mountTarget.insertBefore(container, mountTarget.firstChild);
        }

        const select = document.getElementById("vizitorLangSelect");
        if (select) {
            select.addEventListener("change", (e) => {
                setLanguage(e.target.value);
            });
        }
    }

    // Public API
    window.VIZITOR_I18N = {
        t,
        setLanguage,
        getCurrentLang,
        applyTranslations
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectLanguageSwitcher();
        applyTranslations();
    });
})();
