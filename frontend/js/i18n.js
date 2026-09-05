/**
 * VIZITOR — Multilingual Support Engine (Odia, Marathi, Hindi, English)
 * SIH 2026 / S157 — The ODRISCOLLS
 *
 * CRITICAL RULE:
 * Text changes with language, but Token numbers, queue positions,
 * waiting times, and server telemetry remain 100% IDENTICAL backend values.
 */

(function () {
    "use strict";

    const STORAGE_KEY = "vizitor_lang";

    const LANG_INFO = {
        or: { label: "ଓଡ଼ିଆ", name: "Odia", code: "OR" },
        mr: { label: "मराठी", name: "Marathi", code: "MR" },
        hi: { label: "हिंदी", name: "Hindi", code: "HI" },
        en: { label: "English", name: "English", code: "EN" }
    };

    const TRANSLATIONS = {
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
            activeCounters: "ସକ୍ରିୟ କାଉଣ୍ଟର",
            averageWaitTime: "ହାରାହାରି ଅପେକ୍ଷା ସମୟ",
            serviceRate: "ସେବା ହାର",
            bookAppointment: "ନୂତନ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ",
            serviceName: "ସେବା ନାମ",
            selectDate: "ତାରିଖ ବାଛନ୍ତୁ",
            selectTime: "ସମୟ ବାଛନ୍ତୁ",
            priorityType: "ପ୍ରାଥମିକତା ସ୍ତର",
            priorityNormal: "ସାଧାରଣ (ପ୍ରଥମେ ଆସନ୍ତୁ)",
            priorityEmergency: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା",
            priorityVulnerable: "ବରିଷ୍ଠ / ଭିନ୍ନକ୍ଷମ",
            priorityTimeCritical: "ସମୟ-ସମ୍ବେଦନଶୀଳ",
            cancel: "ବାତିଲ୍",
            confirmBooking: "ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ",
            viewQR: "କ୍ୟୁଆର୍ ପାସ୍",
            qrPassTitle: "ଡିଜିଟାଲ୍ QR ଟୋକନ୍ ପାସ୍",
            qrPassSubtitle: "କ୍ଲିନିକ୍ କାଉଣ୍ଟର କିଓସ୍କ କିମ୍ବା ପ୍ରବେଶ ସ୍କାନରରେ ସ୍କାନ କରନ୍ତୁ",
            printPass: "ପାସ୍ ପ୍ରିଣ୍ଟ୍ କରନ୍ତୁ",
            close: "ବନ୍ଦ କରନ୍ତୁ",
            done: "ସମାପ୍ତ",
            minutesUnit: "ମିନିଟ୍",
            noCrowd: "ଭିଡ଼ ନାହିଁ",
            lowCrowd: "କମ୍ ଭିଡ଼",
            moderateCrowd: "ମଧ୍ୟମ ଭିଡ଼",
            highCrowd: "ଅଧିକ ଭିଡ଼",
            criticalCrowd: "ଅତ୍ୟଧିକ ଭିଡ଼",
            waiting: "ଅପେକ୍ଷାରତ",
            serving: "ସେବା ଚାଲୁଅଛି",
            served: "ସେବା ସମାପ୍ତ",
            confirmed: "ନିଶ୍ଚିତ",
            completed: "ସମାପ୍ତ",
            cancelled: "ବାତିଲ୍",

            // Appointments Page
            myAppointments: "ମୋର ଆପଏଣ୍ଟମେଣ୍ଟ",
            myAppointmentsDesc: "ଆପଣଙ୍କ ଆଗାମୀ ସେବା ଆପଏଣ୍ଟମେଣ୍ଟ ଦେଖନ୍ତୁ, ପରିଚାଳନା କରନ୍ତୁ ଏବଂ ବୁକ୍ କରନ୍ତୁ।",
            upcomingAppointments: "ଆଗାମୀ ଆପଏଣ୍ଟମେଣ୍ଟ",
            previousAppointments: "ପୂର୍ବ ଆପଏଣ୍ଟମେଣ୍ଟ",
            appointmentDetails: "ଆପଏଣ୍ଟମେଣ୍ଟ ବିବରଣୀ",
            confirmCancellation: "ବାତିଲ୍ ନିଶ୍ଚିତ କରନ୍ତୁ",
            cancelConfirmPrompt: "ଆପଣ ଏହି ଆପଏଣ୍ଟମେଣ୍ଟ ବାତିଲ୍ କରିବାକୁ ନିଶ୍ଚିତ କି?",
            yesCancel: "ହଁ, ବାତିଲ୍ କରନ୍ତୁ",
            keepAppointment: "ଆପଏଣ୍ଟମେଣ୍ଟ ରଖନ୍ତୁ",
            appointmentConfirmed: "ଆପଏଣ୍ଟମେଣ୍ଟ ନିଶ୍ଚିତ ହେଲା",
            appointmentConfirmedDesc: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବୁକ୍ ହୋଇଗଲା।",
            appointmentCancelled: "ଆପଏଣ୍ଟମେଣ୍ଟ ବାତିଲ୍ ହେଲା",
            appointmentCancelledDesc: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବାତିଲ୍ କରାଗଲା।",

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

            // Vizi Assistant
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
        },

        mr: {
            brandName: "VIZITOR",
            navDashboard: "डॅशबोर्ड",
            navAppointments: "अपॉइंटमेंट्स",
            navQueue: "थेट रांग",
            navCrowd: "गर्दीची स्थिती",
            navForecast: "गर्दीचा अंदाज",
            navHealthcare: "आरोग्य सेवा ३६०",
            navHospitalMap: "रुग्णालय नकाशा",
            navAnalytics: "विश्लेषण",
            navArcade: "आर्केड आणि निरोगीपणा",
            navNotifications: "सूचना",
            navHelp: "मदत केंद्र",
            navProfile: "प्रोफाइल",
            navLogout: "लॉग आउट",

            // Headers & Common
            liveQueue: "थेट रांग आणि टोकन स्थिती",
            currentlyServing: "सध्या सुरू असलेली सेवा",
            yourToken: "तुमचा टोकन",
            peopleAhead: "पुढील लोक",
            estimatedWait: "अंदाजे प्रतीक्षा वेळ",
            crowdLevel: "गर्दीची पातळी",
            activePeople: "उपस्थित लोक",
            activeCounters: "सक्रिय काउंटर",
            averageWaitTime: "सरासरी प्रतीक्षा वेळ",
            serviceRate: "सेवा दर",
            bookAppointment: "नवीन अपॉइंटमेंट बुक करा",
            serviceName: "सेवेचे नाव",
            selectDate: "तारीख निवडा",
            selectTime: "वेळ निवडा",
            priorityType: "प्राधान्य स्तर",
            priorityNormal: "सामान्य (प्रथम येणाऱ्यास प्राधान्य)",
            priorityEmergency: "आपत्कालीन प्राधान्य (तातडीची काळजी)",
            priorityVulnerable: "ज्येष्ठ / दिव्यांग नागरिक",
            priorityTimeCritical: "वेळेनुसार अत्यंत महत्त्वाचे",
            cancel: "रद्द करा",
            confirmBooking: "अपॉइंटमेंट बुक करा",
            viewQR: "क्यूआर पास",
            qrPassTitle: "डिजिटल क्यूआर टोकन पास",
            qrPassSubtitle: "क्लिनिक काउंटर किंवा प्रवेशद्वारावर स्कॅन करा",
            printPass: "पास प्रिंट करा",
            close: "बंद करा",
            done: "पूर्ण",
            minutesUnit: "मिंट",
            noCrowd: "गर्दी नाही",
            lowCrowd: "कमी गर्दी",
            moderateCrowd: "मध्यम गर्दी",
            highCrowd: "जास्त गर्दी",
            criticalCrowd: "अतिशय जास्त गर्दी",
            waiting: "प्रतीक्षेत",
            serving: "सेवा सुरू आहे",
            served: "सेवा पूर्ण झाली",
            confirmed: "निश्चित",
            completed: "पूर्ण",
            cancelled: "रद्द",

            // Appointments Page
            myAppointments: "माझ्या अपॉइंटमेंट्स",
            myAppointmentsDesc: "तुमच्या आगामी सेवा भेटी पहा, व्यवस्थापित करा आणि बुक करा.",
            upcomingAppointments: "आगामी अपॉइंटमेंट्स",
            previousAppointments: "मागील अपॉइंटमेंट्स",
            appointmentDetails: "अपॉइंटमेंट तपशील",
            confirmCancellation: "रद्दीकरणाची पुष्टी करा",
            cancelConfirmPrompt: "तुम्हाला ही अपॉइंटमेंट नक्की रद्द करायची आहे का?",
            yesCancel: "होय, रद्द करा",
            keepAppointment: "अपॉइंटमेंट ठेवा",
            appointmentConfirmed: "अपॉइंटमेंट निश्चित झाली",
            appointmentConfirmedDesc: "तुमची अपॉइंटमेंट यशस्वीरीत्या बुक झाली आहे.",
            appointmentCancelled: "अपॉइंटमेंट रद्द झाली",
            appointmentCancelledDesc: "तुमची अपॉइंटमेंट यशस्वीरीत्या रद्द करण्यात आली आहे.",

            // Help Center
            helpCenterTitle: "मदत आणि समर्थन केंद्र",
            helpCenterSubtitle: "उत्तरे शोधा, मार्गदर्शन मिळवा आणि सहाय्यक सेटिंग्ज कॉन्फिगर करा.",
            faqTitle: "नेहमी विचारले जाणारे प्रश्न",
            faq1Q: "VIZITOR मध्ये टोकन क्रमांकन कसे कार्य करते?",
            faq1A: "टोकन क्रमांकन वर्तमान सक्रिय वेळापत्रकासाठी A-114 पासून सुरू होते आणि क्रमाने (A-114, A-115, A-116...) वाढते.",
            faq2Q: "आपत्कालीन प्राधान्य बुकिंग काय आहे?",
            faq2A: "आपत्कालीन आणि संवेदनशील रुग्णांना प्राधान्य दिले जाते, ज्यामुळे त्यांची रांग थेट पुढे येते.",
            faq3Q: "एक रुग्ण अनेक चाचण्या किंवा भेटी बुक करू शकतो का?",
            faq3A: "होय! प्रत्येक भेटीसाठी वेगळा टोकन तयार होतो, परंतु गर्दीच्या गणनेत रुग्णाला केवळ १ व्यक्ती म्हणून मोजले जाते.",
            faq4Q: "मी माझा डिजिटल क्यूआर पास कुठे पाहू शकेन?",
            faq4A: "डिजिटल क्यूआर पास अपॉइंटमेंट्स टॅब किंवा थेट रांग पेजवरील 'क्यूआर पास पहा' बटणावरून पाहिला जाऊ शकतो.",

            // Vizi Assistant
            viziHelperTitle: "विझी सहाय्यक",
            viziHelperDesc: "विझीला VIZITOR मध्ये तुमचे मार्गदर्शन करू द्या.",
            viziEnable: "विझी सहाय्यक सक्षम करा",
            viziSound: "ध्वनी प्रभाव",
            viziSoundDesc: "विझीच्या कृतींसाठी मंद आवाज प्ले करा",
            viziFollowMe: "नमस्ते! मी विझी आहे! माझ्या सोबत चला!",
            viziOnboarding: "मी नेहमी तुमच्या मदतीसाठी येथे आहे!",
            viziMsgDashboard: "पुन्हा स्वागत आहे! आज तुम्ही कुठे जाऊ इच्छिता?",
            viziMsgAppointments: "अपॉइंटमेंट हवी आहे का? मी सुरुवात करण्यास मदत करू शकेन.",
            viziMsgQueue: "रांगेत तुमचे स्थान महत्त्वाचे आहे!",
            viziMsgCrowd: "चला पाहूया किती गर्दी आहे.",
            viziMsgForecast: "कदाचित आपण कमी गर्दीची वेळ शोधू शकू.",
            viziMsgHealthcare: "तुमची आरोग्य माहिती महत्त्वाची आहे.",
            viziMsgHospitalMap: "चला योग्य जागा शोधूया.",
            viziMsgArcade: "ठीक आहे... पाच मिनिटांची मजा वाईट नाही 😏",
            viziMsgProfile: "तुमचे तपशील अद्ययावत ठेवल्याने मदत होते!",
            viziMsgReports: "चला पाहूया आकडेवारी काय सांगते.",
            viziMsgHelp: "आहा, माझी आवडती जागा!",
            viziMsgNotifications: "तुमच्या रांगेच्या अद्यतनांसह माहिती मिळवा!",
            viziMsgBookedSuccess: "झाले! तुमची अपॉइंटमेंट बुक झाली आहे!",
            viziMsgSuggestBooking: "तुम्ही तुमची भेट आधीच बुक करू इच्छिता का?",
            viziMsgClick1: "बीप बूप! मी कशी मदत करू शकेन?",
            viziMsgClick2: "सर्व काही सुरळीत सुरू आहे!",
            viziMsgClick3: "मी तुमच्यासाठी रांगेवर लक्ष ठेवून आहे!"
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
            activeCounters: "सक्रिय काउंटर",
            averageWaitTime: "औसत प्रतीक्षा समय",
            serviceRate: "सेवा दर",
            bookAppointment: "नया अपॉइंटमेंट बुक करें",
            serviceName: "सेवा का नाम",
            selectDate: "तारीख चुनें",
            selectTime: "समय चुनें",
            priorityType: "प्राथमिकता स्तर",
            priorityNormal: "सामान्य (पहले आओ)",
            priorityEmergency: "आपातकालीन प्राथमिकता",
            priorityVulnerable: "वरिष्ठ / दिव्यांग",
            priorityTimeCritical: "समय-महत्वपूर्ण",
            cancel: "रद्द करें",
            confirmBooking: "अपॉइंटमेंट बुक करें",
            viewQR: "क्यूआर पास",
            qrPassTitle: "डिजिटल क्यूआर टोकन पास",
            qrPassSubtitle: "क्लिनिक काउंटर या प्रवेश स्कैनर पर स्कैन करें",
            printPass: "पास प्रिंट करें",
            close: "बंद करें",
            done: "पूर्ण",
            minutesUnit: "मिनट",
            noCrowd: "कोई भीड़ नहीं",
            lowCrowd: "कम भीड़",
            moderateCrowd: "मध्यम भीड़",
            highCrowd: "अधिक भीड़",
            criticalCrowd: "अत्यधिक भीड़",
            waiting: "प्रतीक्षारत",
            serving: "सेवा चालू है",
            served: "सेवा पूर्ण",
            confirmed: "पुष्ट",
            completed: "पूर्ण",
            cancelled: "रद्द",

            // Appointments Page
            myAppointments: "मेरे अपॉइंटमेंट्स",
            myAppointmentsDesc: "अपने आगामी अपॉइंटमेंट्स देखें, प्रबंधित करें और बुक करें।",
            upcomingAppointments: "आगामी अपॉइंटमेंट्स",
            previousAppointments: "पिछले अपॉइंटमेंट्स",
            appointmentDetails: "अपॉइंटमेंट विवरण",
            confirmCancellation: "रद्दीकरण की पुष्टि करें",
            cancelConfirmPrompt: "क्या आप वाकई यह अपॉइंटमेंट रद्द करना चाहते हैं?",
            yesCancel: "हाँ, रद्द करें",
            keepAppointment: "अपॉइंटमेंट रखें",
            appointmentConfirmed: "अपॉइंटमेंट की पुष्टि हो गई",
            appointmentConfirmedDesc: "आपका अपॉइंटमेंट सफलतापूर्वक बुक हो गया है।",
            appointmentCancelled: "अपॉइंटमेंट रद्द किया गया",
            appointmentCancelledDesc: "आपका अपॉइंटमेंट सफलतापूर्वक रद्द कर दिया गया है।",

            // Help Center
            helpCenterTitle: "सहायता और सहायता केंद्र",
            helpCenterSubtitle: "उत्तर खोजें, मार्गदर्शन प्राप्त करें और अपने सहायक की सेटिंग्स कॉन्फ़िगर करें।",
            faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
            faq1Q: "VIZITOR में टोकन क्रमांकन कैसे काम करता है?",
            faq1A: "टोकन क्रमांकन वर्तमान सक्रिय अनुसूची के लिए सख्ती से A-114 से शुरू होता है और क्रमिक रूप से आगे बढ़ता है।",
            faq2Q: "आपातकालीन प्राथमिकता बुकिंग क्या है?",
            faq2A: "आपातकालीन और संवेदनशील रोगियों को प्राथमिकता दी जाती है, जिससे उनकी कतार सीधे आगे आ जाती है।",
            faq3Q: "क्या एक मरीज कई टेस्ट या विजिट बुक कर सकता है?",
            faq3A: "हाँ! प्रत्येक विजिट के लिए अलग टोकन बनता है, लेकिन भीड़ मीटर में मरीज को ठीक १ व्यक्ति के रूप में ही गिना जाता है।",
            faq4Q: "मैं अपना डिजिटल क्यूआर पास कहाँ देख सकता हूँ?",
            faq4A: "डिजिटल क्यूआर पास अपॉइंटमेंट्स टैब या लाइव कतार पेज पर 'क्यूआर पास देखें' बटन से देखा जा सकता है।",

            // Vizi Assistant
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
            activeCounters: "Active Counters",
            averageWaitTime: "Average Wait Time",
            serviceRate: "Service Rate",
            bookAppointment: "Book New Appointment",
            serviceName: "Service Name",
            selectDate: "Select Date",
            selectTime: "Select Time",
            priorityType: "Priority Level",
            priorityNormal: "Normal Queue (FCFS)",
            priorityEmergency: "Emergency Priority (Immediate Care)",
            priorityVulnerable: "Senior / Differently Abled",
            priorityTimeCritical: "Time-Critical Consultation",
            cancel: "Cancel",
            confirmBooking: "Book Appointment",
            viewQR: "QR Pass",
            qrPassTitle: "Digital QR Token Pass",
            qrPassSubtitle: "Scan at clinic counter kiosk or entrance scanner",
            printPass: "Print Pass",
            close: "Close",
            done: "Done",
            minutesUnit: "min",
            noCrowd: "No Crowd",
            lowCrowd: "Low",
            moderateCrowd: "Moderate",
            highCrowd: "High",
            criticalCrowd: "Critical",
            waiting: "Waiting",
            serving: "Being Served",
            served: "Served",
            confirmed: "Confirmed",
            completed: "Completed",
            cancelled: "Cancelled",

            // Appointments Page
            myAppointments: "My Appointments",
            myAppointmentsDesc: "View, manage, and book your upcoming service appointments.",
            upcomingAppointments: "Upcoming Appointments",
            previousAppointments: "Previous Appointments",
            appointmentDetails: "Appointment Details",
            confirmCancellation: "Confirm Cancellation",
            cancelConfirmPrompt: "Are you sure you want to cancel this appointment?",
            yesCancel: "Yes, Cancel",
            keepAppointment: "Keep Appointment",
            appointmentConfirmed: "Appointment Confirmed",
            appointmentConfirmedDesc: "Your appointment has been successfully booked.",
            appointmentCancelled: "Appointment Cancelled",
            appointmentCancelledDesc: "Your appointment has been successfully cancelled.",

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

            // Vizi Assistant
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
        }
    };

    // Deep text dictionary for DOM-wide real content translation
    const PHRASE_MAP = {
        // Navigation & Titles
        "Dashboard": { or: "ଡ୍ୟାସବୋର୍ଡ", mr: "डॅशबोर्ड", hi: "डैशबोर्ड" },
        "Appointments": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ", mr: "अपॉइंटमेंट्स", hi: "अपॉइंटमेंट्स" },
        "Live Queue": { or: "ଲାଇଭ ଧାଡ଼ି", mr: "थेट रांग", hi: "लाइव कतार" },
        "Crowd Status": { or: "ଭିଡ଼ ସ୍ଥିତି", mr: "गर्दीची स्थिती", hi: "भीड़ की स्थिति" },
        "Crowd Forecast": { or: "ଭିଡ଼ ପୂର୍ବାନୁମାନ", mr: "गर्दीचा अंदाज", hi: "भीड़ पूर्वानुमान" },
        "Healthcare 360": { or: "ସ୍ୱାସ୍ଥ୍ୟସେବା ୩୬୦", mr: "आरोग्य सेवा ३६०", hi: "स्वास्थ्य 360" },
        "Hospital Map": { or: "ଡାକ୍ତରଖାନା ମାନଚିତ୍ର", mr: "रुग्णालय नकाशा", hi: "अस्पताल का नक्शा" },
        "Analytics": { or: "ବିଶ୍ଳେଷଣ", mr: "विश्लेषण", hi: "विश्लेषण" },
        "Arcade & Wellness": { or: "ଆର୍କେଡ ଓ ସ୍ୱାସ୍ଥ୍ୟ", mr: "आर्केड आणि निरोगीपणा", hi: "आर्केड और स्वास्थ्य" },
        "Notifications": { or: "ବାର୍ତ୍ତା", mr: "सूचना", hi: "सूचनाएं" },
        "Help Centre": { or: "ସହାୟତା କେନ୍ଦ୍ର", mr: "मदत केंद्र", hi: "सहायता केंद्र" },
        "Profile": { or: "ପ୍ରୋଫାଇଲ୍", mr: "प्रोफाइल", hi: "प्रोफ़ाइल" },
        "Logout": { or: "ଲଗ୍ ଆଉଟ୍", mr: "लॉग आउट", hi: "लॉग आउट" },
        "Sign Out": { or: "ଲଗ୍ ଆଉଟ୍", mr: "लॉग आउट", hi: "लॉग आउट" },
        "Help": { or: "ସହାୟତା", mr: "मदत", hi: "सहायता" },
        "Language": { or: "ଭାଷା", mr: "भाषा", hi: "भाषा" },

        // Appointments Page
        "My Appointments": { or: "ମୋର ଆପଏଣ୍ଟମେଣ୍ଟ", mr: "माझ्या अपॉइंटमेंट्स", hi: "मेरे अपॉइंटमेंट्स" },
        "View, manage, and book your upcoming service appointments.": {
            or: "ଆପଣଙ୍କ ଆଗାମୀ ସେବା ଆପଏଣ୍ଟମେଣ୍ଟ ଦେଖନ୍ତୁ, ପରିଚାଳନା କରନ୍ତୁ ଏବଂ ବୁକ୍ କରନ୍ତୁ।",
            mr: "तुमच्या आगामी सेवा भेटी पहा, व्यवस्थापित करा आणि बुक करा.",
            hi: "अपने आगामी अपॉइंटमेंट्स देखें, प्रबंधित करें और बुक करें।"
        },
        "Book New Appointment": { or: "ନୂତନ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ", mr: "नवीन अपॉइंटमेंट बुक करा", hi: "नया अपॉइंटमेंट बुक करें" },
        "Book Appointment": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ", mr: "अपॉइंटमेंट बुक करा", hi: "अपॉइंटमेंट बुक करें" },
        "Upcoming Appointments": { or: "ଆଗାମୀ ଆପଏଣ୍ଟମେଣ୍ଟ", mr: "आगामी अपॉइंटमेंट्स", hi: "आगामी अपॉइंटमेंट्स" },
        "Previous Appointments": { or: "ପୂର୍ବ ଆପଏଣ୍ଟମେଣ୍ଟ", mr: "मागील अपॉइंटमेंट्स", hi: "पिछले अपॉइंटमेंट्स" },
        "Search services...": { or: "ସେବା ଖୋଜନ୍ତୁ...", mr: "सेवा शोधा...", hi: "सेवाएं खोजें..." },
        "Search by service or token...": { or: "ସେବା କିମ୍ବା ଟୋକନ୍ ଦ୍ୱାରା ଖୋଜନ୍ତୁ...", mr: "सेवा किंवा टोकनद्वारे शोधा...", hi: "सेवा या टोकन से खोजें..." },
        "Service": { or: "ସେବା", mr: "सेवा", hi: "सेवा" },
        "Service Name": { or: "ସେବା ନାମ", mr: "सेवेचे नाव", hi: "सेवा का नाम" },
        "Date": { or: "ତାରିଖ", mr: "तारीख", hi: "तारीख" },
        "Time": { or: "ସମୟ", mr: "वेळ", hi: "समय" },
        "Select Date": { or: "ତାରିଖ ବାଛନ୍ତୁ", mr: "तारीख निवडा", hi: "तारीख चुनें" },
        "Select Time": { or: "ସମୟ ବାଛନ୍ତୁ", mr: "वेळ निवडा", hi: "समय चुनें" },
        "Select Service": { or: "ସେବା ବାଛନ୍ତୁ", mr: "सेवा निवडा", hi: "सेवा चुनें" },
        "Token": { or: "ଟୋକନ୍", mr: "टोकन", hi: "टोकन" },
        "Queue Position": { or: "ଧାଡ଼ି ସ୍ଥାନ", mr: "रांगेतील स्थान", hi: "कतार स्थान" },
        "Status": { or: "ସ୍ଥିତି", mr: "स्थिती", hi: "स्थिति" },
        "Action": { or: "କାର୍ଯ୍ୟ", mr: "कृती", hi: "कार्रवाई" },
        "Actions": { or: "କାର୍ଯ୍ୟ", mr: "कृती", hi: "कार्रवाइयां" },
        "Counter": { or: "କାଉଣ୍ଟର", mr: "काउंटर", hi: "काउंटर" },
        "View Details": { or: "ବିବରଣୀ ଦେଖନ୍ତୁ", mr: "तपशील पहा", hi: "विवरण देखें" },
        "QR Pass": { or: "କ୍ୟୁଆର୍ ପାସ୍", mr: "क्यूआर पास", hi: "क्यूआर पास" },
        "Digital QR Token Pass": { or: "ଡିଜିଟାଲ୍ QR ଟୋକନ୍ ପାସ୍", mr: "डिजिटल क्यूआर टोकन पास", hi: "डिजिटल क्यूआर टोकन पास" },
        "Scan at clinic counter kiosk or entrance scanner": {
            or: "କ୍ଲିନିକ୍ କାଉଣ୍ଟର କିଓସ୍କ କିମ୍ବା ପ୍ରବେଶ ସ୍କାନରରେ ସ୍କାନ କରନ୍ତୁ",
            mr: "क्लिनिक काउंटर किंवा प्रवेशद्वारावर स्कॅन करा",
            hi: "क्लिनिक काउंटर या प्रवेश स्कैनर पर स्कैन करें"
        },
        "Scan at clinic counter kiosk": {
            or: "କ୍ଲିନିକ୍ କାଉଣ୍ଟର କିଓସ୍କରେ ସ୍କାନ କରନ୍ତୁ",
            mr: "क्लिनिक काउंटरवर स्कॅन करा",
            hi: "क्लिनिक काउंटर पर स्कैन करें"
        },
        "Print Pass": { or: "ପାସ୍ ପ୍ରିଣ୍ଟ୍ କରନ୍ତୁ", mr: "पास प्रिंट करा", hi: "पास प्रिंट करें" },
        "Done": { or: "ସମାପ୍ତ", mr: "पूर्ण", hi: "पूर्ण" },
        "Close": { or: "ବନ୍ଦ କରନ୍ତୁ", mr: "बंद करा", hi: "बंद करें" },
        "Cancel": { or: "ବାତିଲ୍", mr: "रद्द करा", hi: "रद्द करें" },
        "Confirm": { or: "ନିଶ୍ଚିତ କରନ୍ତୁ", mr: "पुष्टी करा", hi: "पुष्टि करें" },
        "Try Again": { or: "ପୁନର୍ବାର ଚେଷ୍ଟା କରନ୍ତୁ", mr: "पुन्हा प्रयत्न करा", hi: "पुनः प्रयास करें" },
        "Priority Level": { or: "ପ୍ରାଥମିକତା ସ୍ତର", mr: "प्राधान्य स्तर", hi: "प्राथमिकता स्तर" },
        "Normal Queue (FCFS)": { or: "ସାଧାରଣ ଧାଡ଼ି (ପ୍ରଥମେ ଆସନ୍ତୁ)", mr: "सामान्य रांग (प्रथम येणाऱ्यास प्राधान्य)", hi: "सामान्य कतार (पहले आओ)" },
        "Emergency Priority (Immediate Care)": { or: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା (ତୁରନ୍ତ ସେବା)", mr: "आपत्कालीन प्राधान्य (तातडीची काळजी)", hi: "आपातकालीन प्राथमिकता (त्वरित देखभाल)" },
        "Senior / Differently Abled": { or: "ବରିଷ୍ଠ / ଭିନ୍ନକ୍ଷମ ନାଗରିକ", mr: "ज्येष्ठ / दिव्यांग नागरिक", hi: "वरिष्ठ / दिव्यांगजन" },
        "Time-Critical Consultation": { or: "ସମୟ-ସମ୍ବେଦନଶୀଳ ପରାମର୍ଶ", mr: "वेळेनुसार अत्यंत महत्त्वाचे", hi: "समय-महत्वपूर्ण परामर्श" },
        "Emergency Priority": { or: "ଜରୁରୀକାଳୀନ ପ୍ରାଥମିକତା", mr: "आपत्कालीन प्राधान्य", hi: "आपातकालीन प्राथमिकता" },
        "General Consultation": { or: "ସାଧାରଣ ପରାମର୍ଶ", mr: "सामान्य सल्ला", hi: "सामान्य परामर्श" },
        "Document Verification": { or: "ଦଲିଲ ଯାଞ୍ଚ", mr: "कागदपत्र पडताळणी", hi: "दस्तावेज़ सत्यापन" },
        "Health Screening": { or: "ସ୍ୱାସ୍ଥ୍ୟ ପରୀକ୍ଷା", mr: "आरोग्य तपासणी", hi: "स्वास्थ्य जांच" },
        "ID & License Services": { or: "ପରିଚୟ ଓ ଲାଇସେନ୍ସ ସେବା", mr: "ओळखपत्र आणि परवाना सेवा", hi: "पहचान और लाइसेंस सेवाएं" },

        // Appointment Status & Modals
        "Appointment Confirmed": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ ନିଶ୍ଚିତ ହେଲା", mr: "अपॉइंटमेंट निश्चित झाली", hi: "अपॉइंटमेंट की पुष्टि हो गई" },
        "Your appointment has been successfully booked.": {
            or: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବୁକ୍ ହୋଇଗଲା।",
            mr: "तुमची अपॉइंटमेंट यशस्वीरीत्या बुक झाली आहे.",
            hi: "आपका अपॉइंटमेंट सफलतापूर्वक बुक हो गया है।"
        },
        "Appointment Cancelled": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ ବାତିଲ୍ ହେଲା", mr: "अपॉइंटमेंट रद्द झाली", hi: "अपॉइंटमेंट रद्द किया गया" },
        "Your appointment has been successfully cancelled.": {
            or: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ସଫଳତାର ସହ ବାତିଲ୍ କରାଗଲା।",
            mr: "तुमची अपॉइंटमेंट यशस्वीरीत्या रद्द करण्यात आली आहे.",
            hi: "आपका अपॉइंटमेंट सफलतापूर्वक रद्द कर दिया गया है।"
        },
        "Cancellation Confirmed": { or: "ବାତିଲ୍ ନିଶ୍ଚିତ ହେଲା", mr: "रद्दीकरण निश्चित झाले", hi: "रद्दीकरण की पुष्टि हुई" },
        "Confirm Cancellation": { or: "ବାତିଲ୍ ନିଶ୍ଚିତ କରନ୍ତୁ", mr: "रद्दीकरणाची पुष्टी करा", hi: "रद्दीकरण की पुष्टि करें" },
        "Are you sure you want to cancel this appointment?": {
            or: "ଆପଣ ଏହି ଆପଏଣ୍ଟମେଣ୍ଟ ବାତିଲ୍ କରିବାକୁ ନିଶ୍ଚିତ କି?",
            mr: "तुम्हाला ही अपॉइंटमेंट नक्की रद्द करायची आहे का?",
            hi: "क्या आप वाकई यह अपॉइंटमेंट रद्द करना चाहते हैं?"
        },
        "Yes, Cancel": { or: "ହଁ, ବାତିଲ୍ କରନ୍ତୁ", mr: "होय, रद्द करा", hi: "हाँ, रद्द करें" },
        "Keep Appointment": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ ରଖନ୍ତୁ", mr: "अपॉइंटमेंट ठेवा", hi: "अपॉइंटमेंट रखें" },
        "Booking Unsuccessful": { or: "ବୁକିଂ ଅସଫଳ ହେଲା", mr: "बुकिंग अयशस्वी झाली", hi: "बुकिंग असफल रही" },
        "No upcoming appointments": { or: "କୌଣସି ଆଗାମୀ ଆପଏଣ୍ଟମେଣ୍ଟ ନାହିଁ", mr: "कोणत्याही आगामी अपॉइंटमेंट्स नाहीत", hi: "कोई आगामी अपॉइंटमेंट नहीं" },
        "No upcoming appointments.": { or: "କୌଣସି ଆଗାମୀ ଆପଏଣ୍ଟମେଣ୍ଟ ନାହିଁ।", mr: "कोणत्याही आगामी अपॉइंटमेंट्स नाहीत.", hi: "कोई आगामी अपॉइंटमेंट नहीं है।" },
        "No upcoming appointments. Book one using the button above!": {
            or: "କୌଣସି ଆଗାମୀ ଆପଏଣ୍ଟମେଣ୍ଟ ନାହିଁ। ଉପର ବଟନ୍ ବ୍ୟବହାର କରି ଗୋଟିଏ ବୁକ୍ କରନ୍ତୁ!",
            mr: "कोणत्याही आगामी अपॉइंटमेंट्स नाहीत. वरील बटण वापरून एक बुक करा!",
            hi: "कोई आगामी अपॉइंटमेंट नहीं है। ऊपर दिए गए बटन से बुक करें!"
        },
        "Book an appointment above to join the queue": {
            or: "ଧାଡ଼ିରେ ଯୋଗଦେବାକୁ ଉପରେ ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରନ୍ତୁ",
            mr: "रांगेत सामील होण्यासाठी वरून अपॉइंटमेंट बुक करा",
            hi: "कतार में शामिल होने के लिए ऊपर अपॉइंटमेंट बुक करें"
        },
        "Book one using the button above!": {
            or: "ଉପର ବଟନ୍ ବ୍ୟବହାର କରି ଗୋଟିଏ ବୁକ୍ କରନ୍ତୁ!",
            mr: "वरील बटण वापरून एक बुक करा!",
            hi: "ऊपर दिए गए बटन का उपयोग करके बुक करें!"
        },
        "No previous appointments": { or: "କୌଣସି ପୂର୍ବ ଆପଏଣ୍ଟମେଣ୍ଟ ନାହିଁ", mr: "मागील कोणतीही अपॉइंटमेंट नाही", hi: "कोई पुराना अपॉइंटमेंट नहीं" },
        "No previous appointments.": { or: "କୌଣସି ପୂର୍ବ ଆପଏଣ୍ଟମେଣ୍ଟ ନାହିଁ।", mr: "मागील कोणतीही अपॉइंटमेंट नाही.", hi: "कोई पुराना अपॉइंटमेंट नहीं है।" },
        "No previous appointments found": { or: "କୌଣସି ପୂର୍ବ ଆପଏଣ୍ଟମେଣ୍ଟ ମିଳିଲା ନାହିଁ", mr: "मागील कोणतीही अपॉइंटमेंट आढळली नाही", hi: "कोई पुराना अपॉइंटमेंट नहीं मिला" },
        "Please sign in to book an appointment.": {
            or: "ଆପଏଣ୍ଟମେଣ୍ଟ ବୁକ୍ କରିବାକୁ ଦୟାକରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ।",
            mr: "अपॉइंटमेंट बुक करण्यासाठी कृपया साइन इन करा.",
            hi: "अपॉइंटमेंट बुक करने के लिए कृपया साइन इन करें।"
        },
        "Please select a future date": { or: "ଦୟାକରି ଆଗାମୀ ତାରିଖ ବାଛନ୍ତୁ", mr: "कृपया पुढील तारीख निवडा", hi: "कृपया भविष्य की तारीख चुनें" },
        "Please select a valid time": { or: "ଦୟାକରି ଏକ ବୈଧ ସମୟ ବାଛନ୍ତୁ", mr: "कृपया योग्य वेळ निवडा", hi: "कृपया मान्य समय चुनें" },

        // Queue & Token Status
        "My Queue": { or: "ମୋର ଧାଡ଼ି", mr: "माझी रांग", hi: "मेरी कतार" },
        "Live Queue & Token Status": { or: "ଲାଇଭ ଧାଡ଼ି ଓ ଟୋକନ୍ ସ୍ଥିତି", mr: "थेट रांग आणि टोकन स्थिती", hi: "लाइव कतार और टोकन स्थिति" },
        "Real-Time Queue Telemetry": { or: "ଲାଇଭ ଧାଡ଼ି ଟେଲିମେଟ୍ରି", mr: "थेट रांग टेलिमेट्री", hi: "वास्तविक समय कतार टेलीमेट्री" },
        "Now Serving": { or: "ବର୍ତ୍ତମାନ ସେବା", mr: "सध्या सुरू असलेली सेवा", hi: "वर्तमान सेवा" },
        "Your Token": { or: "ଆପଣଙ୍କ ଟୋକନ୍", mr: "तुमचा टोकन", hi: "आपका टोकन" },
        "YOUR TOKEN": { or: "ଆପଣଙ୍କ ଟୋକନ୍", mr: "तुमचा टोकन", hi: "आपका टोकन" },
        "People Ahead": { or: "ଆଗରେ ଥିବା ଲୋକ", mr: "पुढील लोक", hi: "आगे लोग" },
        "Estimated Wait": { or: "ଆନୁମାନିକ ଅପେକ୍ଷା", mr: "अंदाजे प्रतीक्षा वेळ", hi: "अनुमानित प्रतीक्षा" },
        "Active Counters": { or: "ସକ୍ରିୟ କାଉଣ୍ଟର", mr: "सक्रिय काउंटर", hi: "सक्रिय काउंटर" },
        "Service Counters": { or: "ସେବା କାଉଣ୍ଟର", mr: "सेवा काउंटर", hi: "सेवा काउंटर" },
        "Queue Actions": { or: "ଧାଡ଼ି କାର୍ଯ୍ୟ", mr: "रांग कृती", hi: "कतार कार्रवाइयां" },
        "View QR Pass": { or: "QR ପାସ୍ ଦେଖନ୍ତୁ", mr: "क्यूआर पास पहा", hi: "क्यूआर पास देखें" },
        "View Appointment": { or: "ଆପଏଣ୍ଟମେଣ୍ଟ ଦେଖନ୍ତୁ", mr: "अपॉइंटमेंट पहा", hi: "अपॉइंटमेंट देखें" },
        "Facility average wait": { or: "ସୁବିଧାର ହାରାହାରି ଅପେକ୍ଷା ସମୟ", mr: "सुविधेचा सरासरी प्रतीक्षा वेळ", hi: "सुविधा का औसत प्रतीक्षा समय" },
        "Counters open right now": { or: "ବର୍ତ୍ତମାନ ଖୋଲାଥିବା କାଉଣ୍ଟର", mr: "सध्या चालू असलेले काउंटर", hi: "अभी खुले काउंटर" },
        "Service Rate": { or: "ସେବା ହାର", mr: "सेवा दर", hi: "सेवा दर" },
        "Average Wait Time": { or: "ହାରାହାରି ଅପେକ୍ଷା ସମୟ", mr: "सरासरी प्रतीक्षा वेळ", hi: "औसत प्रतीक्षा समय" },
        "Refresh": { or: "ରିଫ୍ରେଶ୍", mr: "रीफ्रेश", hi: "रिफ्रेश" },
        "Refresh Status": { or: "ସ୍ଥିତି ଅଦ୍ୟତନ କରନ୍ତୁ", mr: "स्थिती रीफ्रेश करा", hi: "स्थिति ताज़ा करें" },
        "Refresh Queue": { or: "ଧାଡ଼ି ଅଦ୍ୟତନ କରନ୍ତୁ", mr: "रांग रीफ्रेश करा", hi: "कतार ताज़ा करें" },
        "Today": { or: "ଆଜି", mr: "आज", hi: "आज" },
        "Tomorrow": { or: "ଆସନ୍ତାକାଲି", mr: "उद्या", hi: "कल" },

        // Crowd & Forecast
        "Crowd Level": { or: "ଭିଡ଼ ସ୍ତର", mr: "गर्दीची पातळी", hi: "भीड़ का स्तर" },
        "People Present": { or: "ଉପସ୍ଥିତ ଲୋକ", mr: "उपस्थित लोक", hi: "उपस्थित लोग" },
        "Overview": { or: "ସମୀକ୍ଷା", mr: "आढावा", hi: "अवलोकन" },
        "Reports": { or: "ରିପୋର୍ଟ", mr: "अहवाल", hi: "रिपोर्ट्स" },
        "Crowd Prediction Trend": { or: "ଭିଡ଼ ପୂର୍ବାନୁମାନ ଧାରା", mr: "गर्दीचा अंदाज कल", hi: "भीड़ पूर्वानुमान रुझान" },
        "Forecast Duration Window": { or: "ପୂର୍ବାନୁମାନ ସମୟ ୱିଣ୍ଡୋ", mr: "अंदाज कालावधी", hi: "पूर्वानुमान समयावधि" },
        "Select time horizon for predictive crowd projections.": {
            or: "ପୂର୍ବାନୁମାନ ଭିଡ଼ ପାଇଁ ସମୟ ସୀମା ବାଛନ୍ତୁ।",
            mr: "गर्दीच्या अंदाजासाठी कालावधी निवडा.",
            hi: "अनुमानित भीड़ के लिए समय सीमा चुनें।"
        },
        "Expected Peak Period": { or: "ଅପେକ୍ଷିତ ବ୍ୟସ୍ତ ସମୟ", mr: "अपेक्षित गर्दीची वेळ", hi: "अपेक्षित व्यस्त समय" },
        "Recommended Time to Visit": { or: "ପରିଦର୍ଶନ ପାଇଁ ସୁପାରିଶ ସମୟ", mr: "भेट देण्यासाठी शिफारस केलेली वेळ", hi: "भेंट के लिए अनुशंसित समय" },
        "AI System Recommendation": { or: "ଏଆଇ ପ୍ରଣାଳୀ ସୁପାରିଶ", mr: "एआय प्रणालीची शिफारस", hi: "एआई प्रणाली सिफारिश" },
        "Live Telemetry": { or: "ଲାଇଭ୍ ଟେଲିମେଟ୍ରି", mr: "थेट टेलिमेट्री", hi: "लाइव टेलीमेट्री" },
        "Simulate Crowd (+5)": { or: "ଭିଡ଼ ଅନୁକରଣ (+5)", mr: "गर्दी सिम्युलेशन (+५)", hi: "भीड़ अनुकरण (+5)" },
        "Simulate Crowd (+10)": { or: "ଭିଡ଼ ଅନୁକରଣ (+10)", mr: "गर्दी सिम्युलेशन (+१०)", hi: "भीड़ अनुकरण (+10)" },
        "Simulate Crowd (+20)": { or: "ଭିଡ଼ ଅନୁକରଣ (+20)", mr: "गर्दी सिम्युलेशन (+२०)", hi: "भीड़ अनुकरण (+20)" },
        "Simulate Crowd (+50)": { or: "ଭିଡ଼ ଅନୁକରଣ (+50)", mr: "गर्दी सिम्युलेशन (+५०)", hi: "भीड़ अनुकरण (+50)" },
        "Simulate Crowd": { or: "ଭିଡ଼ ଅନୁକରଣ", mr: "गर्दी सिम्युलेशन", hi: "भीड़ अनुकरण" },
        "No Crowd": { or: "ଭିଡ଼ ନାହିଁ", mr: "गर्दी नाही", hi: "कोई भीड़ नहीं" },
        "Low": { or: "କମ୍", mr: "कमी", hi: "कम" },
        "Moderate": { or: "ମଧ୍ୟମ", mr: "मध्यम", hi: "मध्यम" },
        "High": { or: "ଅଧିକ", mr: "जास्त", hi: "अधिक" },
        "Critical": { or: "ଅତ୍ୟଧିକ", mr: "अतिशय जास्त", hi: "अत्यधिक" },
        "Active": { or: "ସକ୍ରିୟ", mr: "सक्रिय", hi: "सक्रिय" },
        "Waiting": { or: "ଅପେକ୍ଷାରତ", mr: "प्रतीक्षेत", hi: "प्रतीक्षारत" },
        "Being Served": { or: "ସେବା ଚାଲୁଅଛି", mr: "सेवा सुरू आहे", hi: "सेवा चालू है" },
        "Served": { or: "ସେବା ସମାପ୍ତ", mr: "सेवा पूर्ण", hi: "सेवा पूर्ण" },
        "Confirmed": { or: "ନିଶ୍ଚିତ", mr: "निश्चित", hi: "पुष्ट" },
        "Completed": { or: "ସମାପ୍ତ", mr: "पूर्ण", hi: "पूर्ण" },
        "Cancelled": { or: "ବାତିଲ୍", mr: "रद्द", hi: "रद्द" },
        "In Progress": { or: "ଚାଲୁଅଛି", mr: "प्रगतीपथावर", hi: "प्रगति पर" },

        // Healthcare Network & Map
        "Hospital Location": { or: "ଡାକ୍ତରଖାନାର ସ୍ଥାନ", mr: "रुग्णालयाचे स्थान", hi: "अस्पताल का स्थान" },
        "Find a nearby hospital and view its location.": {
            or: "ନିକଟସ୍ଥ ଡାକ୍ତରଖାନା ଖୋଜନ୍ତୁ ଏବଂ ଏହାର ସ୍ଥାନ ଦେଖନ୍ତୁ।",
            mr: "जवळचे रुग्णालय शोधा आणि त्याचे स्थान पहा.",
            hi: "पास का अस्पताल खोजें और उसका स्थान देखें।"
        },
        "← Back to Dashboard": { or: "← ଡ୍ୟାସବୋର୍ଡକୁ ଫେରନ୍ତୁ", mr: "← डॅशबोर्डवर परत जा", hi: "← डैशबोर्ड पर वापस" },
        "Facilities & Routing": { or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ଓ ରୁଟିଂ", mr: "सुविधा आणि मार्गक्रमण", hi: "सुविधाएं और रूटिंग" },
        "Facility Discovery & Crowd-Aware Routing": {
            or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ସନ୍ଧାନ ଓ ଭିଡ଼-ଅନୁକୂଳ ରୁଟିଂ",
            mr: "सुविधा शोध आणि गर्दी-जागरूक मार्गक्रमण",
            hi: "सुविधा खोज और भीड़-जागरूक रूटिंग"
        },
        "Facility Discovery": { or: "ସ୍ୱାସ୍ଥ୍ୟକେନ୍ଦ୍ର ସନ୍ଧାନ", mr: "सुविधा शोध", hi: "सुविधा खोज" },
        "Specialists & OPD": { or: "ବିଶେଷଜ୍ଞ ଓ ଓପିଡି", mr: "तज्ज्ञ आणि ओपीडी", hi: "विशेषज्ञ और ओपीडी" },
        "Specialists": { or: "ବିଶେଷଜ୍ଞ", mr: "तज्ज्ञ", hi: "विशेषज्ञ" },
        "Diagnostics & Lab": { or: "ନିଦାନ ଓ ଲାବୋରେଟୋରୀ", mr: "निदान आणि प्रयोगशाळा", hi: "निदान और प्रयोगशाला" },
        "Diagnostics": { or: "ନିଦାନ", mr: "निदान", hi: "निदान" },
        "Medicines & Inventory": { or: "ଔଷଧ ଓ ଭଣ୍ଡାର", mr: "औषधे आणि साठा", hi: "दवाएं और इन्वेंट्री" },
        "Medicines": { or: "ଔଷଧ", mr: "औषधे", hi: "दवाएं" },
        "Referral Tracking": { or: "ରେଫରାଲ୍ ଟ୍ରାକିଂ", mr: "रेफरल ट्रॅकिंग", hi: "रेफरल ट्रैकिंग" },
        "Referrals": { or: "ରେଫରାଲ୍", mr: "रेफरल्स", hi: "रेफरल" },
        "Patient 360": { or: "ରୋଗୀ ୩୬୦", mr: "रुग्ण ३६०", hi: "रोगी 360" },
        "Cardiology": { or: "ହୃଦରୋଗ ବିଜ୍ଞାନ", mr: "हृदयरोगशास्त्र", hi: "हृदय रोग विज्ञान" },
        "Pediatrics": { or: "ଶିଶୁରୋଗ ଚିକିତ୍ସା", mr: "बालरोगशास्त्र", hi: "बाल चिकित्सा" },
        "Orthopedics": { or: "ଅସ୍ଥିଶଲ୍ୟ ଚିକିତ୍ସା", mr: "अस्थिरोगशास्त्र", hi: "अस्थि रोग विज्ञान" },
        "Gynecology": { or: "ସ୍ତ୍ରୀରୋଗ ଚିକିତ୍ସା", mr: "स्त्रीरोगशास्त्र", hi: "स्त्री रोग विज्ञान" },
        "General Medicine": { or: "ସାଧାରଣ ଚିକିତ୍ସା", mr: "सामान्य औषधशास्त्र", hi: "सामान्य चिकित्सा" },
        "Neurology": { or: "ସ୍ନାୟୁରୋଗ ବିଜ୍ଞାନ", mr: "मज्जारोगशास्त्र", hi: "तंत्रिका विज्ञान" },
        "Available": { or: "ଉପଲବ୍ଧ", mr: "उपलब्ध", hi: "उपलब्ध" },
        "Unavailable": { or: "ଅନୁପଲବ୍ଧ", mr: "अनुपलब्ध", hi: "अनुपलब्ध" },
        "On Leave": { or: "ଛୁଟିରେ", mr: "रजेवर", hi: "छुट्टी पर" },
        "Busy": { or: "ବ୍ୟସ୍ତ", mr: "व्यस्त", hi: "व्यस्त" },
        "In Stock": { or: "ଭଣ୍ଡାରରେ ଉପଲବ୍ଧ", mr: "साठ्यात उपलब्ध", hi: "स्टॉक में उपलब्ध" },
        "Out of Stock": { or: "ଭଣ୍ଡାର ଶେଷ", mr: "साठा संपला", hi: "स्टॉक समाप्त" },
        "Online": { or: "ଅନଲାଇନ୍", mr: "ऑनलाइन", hi: "ऑनलाइन" },
        "Offline": { or: "ଅଫଲାଇନ୍", mr: "ऑफलाइन", hi: "ऑफ़लाइन" },

        // Auth & Profile
        "Welcome Back": { or: "ସ୍ୱାଗତମ୍", mr: "पुन्हा स्वागत आहे", hi: "वापसी पर स्वागत" },
        "Welcome back": { or: "ସ୍ୱାଗତମ୍", mr: "पुन्हा स्वागत आहे", hi: "वापसी पर स्वागत" },
        "Sign in to access your dashboard": { or: "ଆପଣଙ୍କ ଡ୍ୟାସବୋର୍ଡ ଦେଖିବାକୁ ସାଇନ୍ ଇନ୍ କରନ୍ତୁ", mr: "तुमचा डॅशबोर्ड पाहण्यासाठी साइन इन करा", hi: "अपने डैशबोर्ड तक पहुंचने के लिए साइन इन करें" },
        "Sign In": { or: "ସାଇନ୍ ଇନ୍", mr: "साइन इन करा", hi: "साइन इन" },
        "Sign in": { or: "ସାଇନ୍ ଇନ୍", mr: "साइन इन करा", hi: "साइन इन" },
        "Sign Up": { or: "ସାଇନ୍ ଅପ୍", mr: "साइन अप करा", hi: "साइन अप" },
        "Create Account": { or: "ଖାତା ଖୋଲନ୍ତୁ", mr: "खाते तयार करा", hi: "खाता बनाएं" },
        "Password": { or: "ପାସୱାର୍ଡ", mr: "पासवर्ड", hi: "पासवर्ड" },
        "Remember me": { or: "ମନେ ରଖନ୍ତୁ", mr: "मला लक्षात ठेवा", hi: "मुझे याद रखें" },
        "Forgot password?": { or: "ପାସୱାର୍ଡ ଭୁଲିଗଲେ କି?", mr: "पासवर्ड विसरलात?", hi: "पासवर्ड भूल गए?" },
        "Don't have an account?": { or: "ଖାତା ନାହିଁ କି?", mr: "खाते नाही का?", hi: "खाता नहीं है?" },
        "Already have an account?": { or: "ପୂର୍ବରୁ ଖାତା ଅଛି କି?", mr: "आधीच खाते आहे का?", hi: "पहले से खाता है?" },
        "Patient Name": { or: "ରୋଗୀଙ୍କ ନାମ", mr: "रुग्णाचे नाव", hi: "रोगी का नाम" },
        "Phone Number": { or: "ଫୋନ୍ ନମ୍ବର", mr: "फोन नंबर", hi: "फ़ोन नंबर" },
        "Email Address": { or: "ଇମେଲ୍ ଠିକଣା", mr: "ईमेल पत्ता", hi: "ईमेल पता" },
        "Save Changes": { or: "ପରିବର୍ତ୍ତନ ସଂରକ୍ଷଣ କରନ୍ତୁ", mr: "बदल जतन करा", hi: "परिवर्तन सहेजें" },
        "Edit Profile": { or: "ପ୍ରୋଫାଇଲ୍ ସଂପାଦନ କରନ୍ତୁ", mr: "प्रोफाइल संपादित करा", hi: "प्रोफ़ाइल संपादित करें" },
        "Clear all": { or: "ସବୁ ହଟାନ୍ତୁ", mr: "सर्व साफ करा", hi: "सभी साफ़ करें" },
        "Mark all as read": { or: "ସବୁ ପଢ଼ାଗଲା ଭାବେ ଚିହ୍ନିତ କରନ୍ତୁ", mr: "सर्व वाचलेले म्हणून चिन्हांकित करा", hi: "सभी को पढ़ा हुआ चिह्नित करें" },
        "No notifications": { or: "କୌଣସି ବାର୍ତ୍ତା ନାହିଁ", mr: "कोणतीही सूचना नाही", hi: "कोई सूचना नहीं" }
    };

    // Regex dynamic phrase patterns
    const PATTERNS = [
        {
            regex: /^Counter\s+(\d+)$/i,
            render: (match, lang) => {
                const n = match[1];
                if (lang === "or") return `କାଉଣ୍ଟର ${n}`;
                if (lang === "mr") return `काउंटर ${n}`;
                if (lang === "hi") return `काउंटर ${n}`;
                return `Counter ${n}`;
            }
        },
        {
            regex: /^Queue\s+Position:\s*#?(\d+)$/i,
            render: (match, lang) => {
                const n = match[1];
                if (lang === "or") return `ଧାଡ଼ି ସ୍ଥାନ: #${n}`;
                if (lang === "mr") return `रांगेतील स्थान: #${n}`;
                if (lang === "hi") return `कतार स्थान: #${n}`;
                return `Queue Position: #${n}`;
            }
        },
        {
            regex: /^(\d+)\s+People\s+Ahead$/i,
            render: (match, lang) => {
                const n = match[1];
                if (lang === "or") return `${n} ଆଗରେ ଥିବା ଲୋକ`;
                if (lang === "mr") return `${n} पुढील लोक`;
                if (lang === "hi") return `${n} आगे लोग`;
                return `${n} People Ahead`;
            }
        },
        {
            regex: /^Estimated\s+Wait:\s*(\d+)\s*(min|mins|minutes)?$/i,
            render: (match, lang) => {
                const n = match[1];
                if (lang === "or") return `ଆନୁମାନିକ ଅପେକ୍ଷା: ${n} ମିନିଟ୍`;
                if (lang === "mr") return `अंदाजे प्रतीक्षा: ${n} मिनिटे`;
                if (lang === "hi") return `अनुमानित प्रतीक्षा: ${n} मिनट`;
                return `Estimated Wait: ${n} min`;
            }
        },
        {
            regex: /^(\d+)\s*(min|mins|minutes)$/i,
            render: (match, lang) => {
                const n = match[1];
                if (lang === "or") return `${n} ମିନିଟ୍`;
                if (lang === "mr") return `${n} मिनिटे`;
                if (lang === "hi") return `${n} मिनट`;
                return `${n} min`;
            }
        }
    ];

    function getCurrentLang() {
        return localStorage.getItem(STORAGE_KEY) || "or";
    }

    function setLanguage(lang) {
        if (!TRANSLATIONS[lang]) lang = "or";
        localStorage.setItem(STORAGE_KEY, lang);
        applyTranslations();
        window.dispatchEvent(new CustomEvent("vizitorLanguageChanged", { detail: { lang } }));
    }

    function t(key) {
        const lang = getCurrentLang();
        return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) ||
               (TRANSLATIONS.or && TRANSLATIONS.or[key]) ||
               (TRANSLATIONS.en && TRANSLATIONS.en[key]) ||
               key;
    }

    function tPhrase(phrase) {
        if (!phrase || typeof phrase !== "string") return phrase;
        const lang = getCurrentLang();
        if (lang === "en") return phrase;

        const trimmed = phrase.trim();
        if (PHRASE_MAP[trimmed] && PHRASE_MAP[trimmed][lang]) {
            return phrase.replace(trimmed, PHRASE_MAP[trimmed][lang]);
        }

        for (const p of PATTERNS) {
            const match = trimmed.match(p.regex);
            if (match) {
                return p.render(match, lang);
            }
        }

        return phrase;
    }

    // Node-level memory to allow perfect bi-directional language switching
    const nodeOrigMap = new WeakMap();

    function translateTextNode(node, lang) {
        let orig = nodeOrigMap.get(node);
        if (orig === undefined) {
            orig = node.nodeValue;
            nodeOrigMap.set(node, orig);
        }

        const trimmed = orig.trim();
        if (!trimmed) return;

        if (lang === "en") {
            if (node.nodeValue !== orig) {
                node.nodeValue = orig;
            }
            return;
        }

        // 1. Direct dictionary match
        if (PHRASE_MAP[trimmed] && PHRASE_MAP[trimmed][lang]) {
            node.nodeValue = orig.replace(trimmed, PHRASE_MAP[trimmed][lang]);
            return;
        }

        // 2. Pattern match
        for (const p of PATTERNS) {
            const match = trimmed.match(p.regex);
            if (match) {
                node.nodeValue = orig.replace(trimmed, p.render(match, lang));
                return;
            }
        }
    }

    function translateSubtree(root, lang) {
        if (!root) return;

        // Skip language switcher elements
        if (root.id === "vizitorLangSwitcher" || (root.closest && root.closest("#vizitorLangSwitcher"))) {
            return;
        }
        if (root.id === "vizitorFloatingLang" || (root.closest && root.closest("#vizitorFloatingLang"))) {
            return;
        }

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    const tag = parent.tagName.toLowerCase();
                    if (tag === "script" || tag === "style" || tag === "svg" || tag === "path" || tag === "code" || tag === "pre" || tag === "textarea") {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (parent.closest("#vizitorLangSwitcher") || parent.closest("#vizitorFloatingLang")) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (!node.nodeValue || !node.nodeValue.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let currentNode;
        while ((currentNode = walker.nextNode())) {
            translateTextNode(currentNode, lang);
        }

        // Translate Placeholders
        const inputs = root.querySelectorAll ? root.querySelectorAll("input[placeholder], textarea[placeholder]") : [];
        inputs.forEach(el => {
            const raw = el.getAttribute("data-v-orig-ph") || el.placeholder;
            if (!el.getAttribute("data-v-orig-ph")) {
                el.setAttribute("data-v-orig-ph", raw);
            }
            const trimmed = raw.trim();
            if (lang === "en") {
                el.placeholder = raw;
            } else if (PHRASE_MAP[trimmed] && PHRASE_MAP[trimmed][lang]) {
                el.placeholder = PHRASE_MAP[trimmed][lang];
            }
        });

        // Translate Title attributes
        const titles = root.querySelectorAll ? root.querySelectorAll("[title]") : [];
        titles.forEach(el => {
            const raw = el.getAttribute("data-v-orig-title") || el.title;
            if (!el.getAttribute("data-v-orig-title")) {
                el.setAttribute("data-v-orig-title", raw);
            }
            const trimmed = raw.trim();
            if (lang === "en") {
                el.title = raw;
            } else if (PHRASE_MAP[trimmed] && PHRASE_MAP[trimmed][lang]) {
                el.title = PHRASE_MAP[trimmed][lang];
            }
        });
    }

    let isApplying = false;

    function applyTranslations() {
        if (isApplying) return;
        isApplying = true;

        const lang = getCurrentLang();
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.or;
        const currentInfo = LANG_INFO[lang] || LANG_INFO.or;

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
            "profile.html": dict.navProfile
        };

        document.querySelectorAll(".sidebar-menu .menu-item").forEach(a => {
            const href = a.getAttribute("href");
            const span = a.querySelector("span");
            if (span && href && menuLinks[href]) {
                span.textContent = menuLinks[href];
            }
        });

        // 3. Deep text node recursive scan across document body
        if (document.body) {
            translateSubtree(document.body, lang);
        }

        // 4. Update language switcher button label & active option highlights
        document.querySelectorAll(".vizitor-current-lang-text").forEach(el => {
            el.textContent = `${currentInfo.label} (${currentInfo.code})`;
        });

        document.querySelectorAll(".vizitor-lang-opt").forEach(btn => {
            if (btn.getAttribute("data-lang") === lang) {
                btn.style.background = "#f5f3ff";
                btn.style.color = "#7c3aed";
                btn.style.fontWeight = "700";
            } else {
                btn.style.background = "transparent";
                btn.style.color = "#1e293b";
                btn.style.fontWeight = "500";
            }
        });

        // 5. Update existing page <select id="langSelector"> elements
        document.querySelectorAll("#langSelector").forEach(sel => {
            sel.value = lang;
        });

        isApplying = false;
    }

    function createLanguageSwitcherHTML(isFloating = false) {
        const currentLang = getCurrentLang();
        const currentInfo = LANG_INFO[currentLang] || LANG_INFO.or;

        return `
            <div style="position:relative;display:inline-flex;align-items:center;">
                <button type="button" class="vizitor-lang-btn" aria-haspopup="true" aria-expanded="false" title="Change Language / ଭାଷା ବଦଳାନ୍ତୁ" style="display:inline-flex;align-items:center;gap:7px;background:#ffffff;border:1.5px solid #7c3aed;border-radius:20px;padding:6px 14px;font-size:0.85rem;font-weight:700;color:#1e293b;cursor:pointer;box-shadow:0 2px 6px rgba(124,58,237,0.15);transition:all 0.15s ease;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color:#7c3aed;flex-shrink:0;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    <span class="vizitor-current-lang-text" style="color:#0f172a;letter-spacing:0.2px;">${currentInfo.label} (${currentInfo.code})</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#7c3aed;margin-left:1px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <div class="vizitor-lang-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);right:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,0.18);min-width:185px;padding:6px;z-index:10001;">
                    <div style="font-size:0.75rem;font-weight:700;color:#64748b;padding:6px 10px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;margin-bottom:4px;display:flex;align-items:center;gap:4px;">
                        <span>🌐</span> Select Language
                    </div>
                    <button type="button" class="vizitor-lang-opt" data-lang="or" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;font-size:0.875rem;text-align:left;transition:background 0.15s;">
                        <span style="font-weight:700;">ଓଡ଼ିଆ</span>
                        <span style="font-size:0.75rem;color:#64748b;">Odia (OR)</span>
                    </button>
                    <button type="button" class="vizitor-lang-opt" data-lang="mr" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;font-size:0.875rem;text-align:left;transition:background 0.15s;">
                        <span style="font-weight:700;">मराठी</span>
                        <span style="font-size:0.75rem;color:#64748b;">Marathi (MR)</span>
                    </button>
                    <button type="button" class="vizitor-lang-opt" data-lang="hi" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;font-size:0.875rem;text-align:left;transition:background 0.15s;">
                        <span style="font-weight:700;">हिंदी</span>
                        <span style="font-size:0.75rem;color:#64748b;">Hindi (HI)</span>
                    </button>
                    <button type="button" class="vizitor-lang-opt" data-lang="en" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:9px 12px;border:none;border-radius:8px;background:transparent;cursor:pointer;font-size:0.875rem;text-align:left;transition:background 0.15s;">
                        <span style="font-weight:700;">English</span>
                        <span style="font-size:0.75rem;color:#64748b;">English (EN)</span>
                    </button>
                </div>
            </div>
        `;
    }

    function wireSwitcherEvents(wrapper) {
        const btn = wrapper.querySelector(".vizitor-lang-btn");
        const dropdown = wrapper.querySelector(".vizitor-lang-dropdown");
        if (!btn || !dropdown) return;

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === "block";
            // Close all open dropdowns first
            document.querySelectorAll(".vizitor-lang-dropdown").forEach(d => d.style.display = "none");
            dropdown.style.display = isOpen ? "none" : "block";
            btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
        });

        wrapper.querySelectorAll(".vizitor-lang-opt").forEach(opt => {
            opt.addEventListener("click", (e) => {
                e.stopPropagation();
                const chosen = opt.getAttribute("data-lang");
                dropdown.style.display = "none";
                btn.setAttribute("aria-expanded", "false");
                setLanguage(chosen);
            });
            opt.addEventListener("mouseenter", () => {
                if (opt.getAttribute("data-lang") !== getCurrentLang()) {
                    opt.style.background = "#f8fafc";
                }
            });
            opt.addEventListener("mouseleave", () => {
                if (opt.getAttribute("data-lang") !== getCurrentLang()) {
                    opt.style.background = "transparent";
                }
            });
        });
    }

    function injectLanguageSwitcher() {
        // 1. Check if Header Language Switcher exists
        if (!document.getElementById("vizitorLangSwitcher")) {
            const container = document.createElement("div");
            container.id = "vizitorLangSwitcher";
            container.className = "vizitor-lang-switcher-container";
            container.style.cssText = "display:inline-flex;align-items:center;margin-right:0.6rem;z-index:999;";
            container.innerHTML = createLanguageSwitcherHTML(false);

            const mountTarget =
                document.querySelector(".topbar-right") ||
                document.querySelector(".topbar") ||
                document.querySelector(".user-nav") ||
                document.querySelector(".header-right") ||
                document.querySelector(".dashboard-header");

            if (mountTarget) {
                mountTarget.insertBefore(container, mountTarget.firstChild);
                wireSwitcherEvents(container);
            }
        }

        // 2. Floating Language Button for pages without top header (Auth, Login, Signup, Map, etc.)
        if (!mountTarget && document.body && !document.getElementById("vizitorFloatingLang")) {
            const floatBox = document.createElement("div");
            floatBox.id = "vizitorFloatingLang";
            floatBox.style.cssText = "position:fixed;top:18px;right:22px;z-index:100000;";
            floatBox.innerHTML = createLanguageSwitcherHTML(false);
            document.body.appendChild(floatBox);
            wireSwitcherEvents(floatBox);
        }

        // 3. Add Language Item into Sidebar if present and not already added
        const sidebarMenu = document.querySelector(".sidebar-menu") || document.querySelector(".sidebar-nav");
        if (sidebarMenu && !document.getElementById("sidebarLangItem")) {
            const sideItem = document.createElement("a");
            sideItem.id = "sidebarLangItem";
            sideItem.href = "javascript:void(0)";
            sideItem.className = "menu-item";
            sideItem.title = "Change Language / ଭାଷା ବଦଳାନ୍ତୁ";
            sideItem.style.cssText = "cursor:pointer;";
            sideItem.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#7c3aed;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span>Language (ଭାଷା)</span>
            `;
            sideItem.addEventListener("click", (e) => {
                e.preventDefault();
                // Find and click the header language button or cycle language
                const headerBtn = document.querySelector("#vizitorLangSwitcher .vizitor-lang-btn") ||
                                  document.querySelector("#vizitorFloatingLang .vizitor-lang-btn");
                if (headerBtn) {
                    headerBtn.click();
                } else {
                    const langs = ["or", "mr", "hi", "en"];
                    const cur = getCurrentLang();
                    const next = langs[(langs.indexOf(cur) + 1) % langs.length];
                    setLanguage(next);
                }
            });
            sidebarMenu.appendChild(sideItem);
        }

        // 4. Enhance and hide native <select id="langSelector"> on healthcare network pages
        document.querySelectorAll("#langSelector").forEach(sel => {
            sel.style.display = "none";
            if (!sel.querySelector('option[value="mr"]')) {
                const optMr = document.createElement("option");
                optMr.value = "mr";
                optMr.textContent = "मराठी (MR)";
                sel.appendChild(optMr);
            }
            sel.value = getCurrentLang();
            if (!sel.dataset.vizitorWired) {
                sel.dataset.vizitorWired = "true";
                sel.addEventListener("change", (e) => {
                    setLanguage(e.target.value);
                });
            }
        });

        // 5. Close dropdown on any document click
        if (!window._vizitorLangDocClickWired) {
            window._vizitorLangDocClickWired = true;
            document.addEventListener("click", () => {
                document.querySelectorAll(".vizitor-lang-dropdown").forEach(d => {
                    d.style.display = "none";
                });
                document.querySelectorAll(".vizitor-lang-btn").forEach(b => {
                    b.setAttribute("aria-expanded", "false");
                });
            });
        }
    }

    // Dynamic content observer for async UI renders (Appointment lists, Queue updates, Modals)
    let observerTimeout = null;
    let domObserver = null;

    function initMutationObserver() {
        if (!document.body) return;
        if (domObserver) return;

        domObserver = new MutationObserver((mutations) => {
            if (isApplying) return;

            let hasNewNodes = false;
            for (const m of mutations) {
                if (m.type === "childList" && m.addedNodes.length > 0) {
                    for (const n of m.addedNodes) {
                        if (n.nodeType === Node.ELEMENT_NODE) {
                            if (n.id === "vizitorLangSwitcher" ||
                                n.id === "vizitorFloatingLang" ||
                                n.id === "sidebarLangItem" ||
                                (n.closest && (n.closest("#vizitorLangSwitcher") || n.closest("#vizitorFloatingLang")))) {
                                continue;
                            }
                            hasNewNodes = true;
                            break;
                        }
                    }
                }
                if (hasNewNodes) break;
            }

            if (hasNewNodes) {
                if (observerTimeout) clearTimeout(observerTimeout);
                observerTimeout = setTimeout(() => {
                    applyTranslations();
                    injectLanguageSwitcher();
                }, 40);
            }
        });

        domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Public API
    window.VIZITOR_I18N = {
        t,
        tPhrase,
        setLanguage,
        getCurrentLang,
        applyTranslations
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            injectLanguageSwitcher();
            applyTranslations();
            initMutationObserver();
        });
    } else {
        injectLanguageSwitcher();
        applyTranslations();
        initMutationObserver();
    }
})();
