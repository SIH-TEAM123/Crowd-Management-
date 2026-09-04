from sqlalchemy import select

from app.database import SessionLocal
from app.models.article import Article


ARTICLES = [
    {
        "slug": "stay-hydrated-while-waiting",
        "title": "Stay Hydrated While You Wait",
        "category": "Wellness",
        "summary": "Simple hydration habits can help you stay comfortable during a longer hospital visit.",
        "content": """Waiting at a hospital can sometimes take longer than expected.

Keep water with you when possible and take small, regular sips rather than waiting until you feel very thirsty.

If a healthcare professional has asked you to restrict fluids, follow their instructions instead.

For children, older adults, and people who may have difficulty recognizing thirst, regular hydration can be especially important.

If you feel unusually weak, dizzy, confused, or seriously unwell, inform hospital staff instead of simply continuing to wait.""",
        "reading_time_minutes": 2,
        "min_wait_minutes": 5,
        "max_wait_minutes": 30,
    },
    {
        "slug": "prepare-your-medication-list",
        "title": "Prepare a Simple Medication List",
        "category": "Health Awareness",
        "summary": "Keeping an updated medication list can make conversations with healthcare professionals easier.",
        "content": """Before a consultation, write down the medicines and supplements you currently take.

Include the name, strength when known, and how often you normally take each medicine.

Also note important allergies or previous reactions to medicines.

A written list can reduce the chance of forgetting an important detail during a busy appointment.

Do not stop, start, or change a prescribed medicine simply because of an article. Discuss medication changes with an appropriate healthcare professional.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 8,
        "max_wait_minutes": 40,
    },
    {
        "slug": "understand-your-vital-signs",
        "title": "Understanding Common Vital Signs",
        "category": "Health Awareness",
        "summary": "Learn what common measurements such as pulse, temperature, and blood pressure represent.",
        "content": """During a healthcare visit, you may see measurements such as temperature, pulse rate, blood pressure, and oxygen saturation.

These measurements provide useful information about your current condition, but one number alone does not tell the complete story.

Healthcare professionals interpret measurements together with symptoms, medical history, examination findings, and other information.

If you receive a measurement that concerns you, ask the healthcare team what it means for your particular situation.

Avoid comparing your numbers directly with another person's numbers without professional context.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 10,
        "max_wait_minutes": 45,
    },
    {
        "slug": "hand-hygiene-in-healthcare",
        "title": "Why Hand Hygiene Matters",
        "category": "Prevention",
        "summary": "Good hand hygiene is one of the simplest ways to reduce the spread of germs.",
        "content": """Hospitals and clinics are shared environments where many people come into contact with healthcare workers, equipment, and surfaces.

Clean your hands regularly, especially after using shared facilities and before eating.

Use soap and water when appropriate, or an alcohol-based hand sanitizer when suitable.

Healthcare workers may also clean their hands before and after examining patients.

If you are unsure about hand hygiene in a particular area, follow the facility's instructions.""",
        "reading_time_minutes": 2,
        "min_wait_minutes": 3,
        "max_wait_minutes": 25,
    },
    {
        "slug": "make-your-appointment-more-effective",
        "title": "Make the Most of Your Appointment",
        "category": "Appointment Tips",
        "summary": "A little preparation can help you communicate your concerns clearly during a consultation.",
        "content": """Before your appointment, think about the main reason you are seeking care.

Write down important symptoms, when they started, what makes them better or worse, and any questions you want to ask.

Keep relevant reports, prescriptions, and previous medical information available when appropriate.

During the consultation, explain your concerns clearly and ask for clarification if something is difficult to understand.

Before leaving, make sure you understand the next steps, follow-up plan, and any instructions provided by your healthcare professional.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 10,
        "max_wait_minutes": 50,
    },
    {
        "slug": "use-waiting-time-productively",
        "title": "Turn Waiting Time Into Useful Time",
        "category": "Productivity",
        "summary": "A few minutes of waiting can be used for preparation, relaxation, or learning.",
        "content": """Waiting for an appointment does not always have to mean doing nothing.

You can review your appointment details, organize questions for your healthcare professional, read trusted health information, or simply take a few quiet minutes to relax.

If you have an important task to complete, choose something that can be paused easily when your token is called.

Most importantly, keep an eye on queue updates and remain available when hospital staff need you.""",
        "reading_time_minutes": 2,
        "min_wait_minutes": 5,
        "max_wait_minutes": 20,
    },
    {
        "slug": "sleep-and-recovery",
        "title": "Small Habits That Support Better Sleep",
        "category": "Wellness",
        "summary": "Consistent sleep habits can support general wellbeing and daily functioning.",
        "content": """Good sleep habits are part of maintaining general wellbeing.

Try to keep a reasonably consistent sleep and wake schedule.

A calm bedtime routine and a comfortable, quiet sleeping environment may make it easier to settle down.

Avoid relying on screens, caffeine, or other stimulants immediately before bedtime if they interfere with your sleep.

If sleep problems persist or significantly affect your daily life, consider discussing them with a healthcare professional.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 15,
        "max_wait_minutes": 60,
    },
    {
        "slug": "when-to-seek-urgent-help",
        "title": "When Waiting Should Not Continue",
        "category": "Safety",
        "summary": "Some symptoms require immediate attention rather than continuing to wait for a routine appointment.",
        "content": """A routine queue should never delay emergency care.

If you or someone with you develops severe difficulty breathing, severe chest pain, loss of consciousness, sudden serious weakness, uncontrolled bleeding, or another potentially life-threatening condition, seek immediate help from hospital staff or emergency services.

Do not wait for a normal appointment token when a medical emergency may be occurring.

This article is general health information and is not a substitute for assessment by a qualified healthcare professional.""",
        "reading_time_minutes": 2,
        "min_wait_minutes": 0,
        "max_wait_minutes": 15,
    },
    {
        "slug": "questions-to-ask-your-doctor",
        "title": "Questions You Can Ask Your Doctor",
        "category": "Appointment Tips",
        "summary": "Preparing a few questions can help you better understand your consultation and next steps.",
        "content": """It is completely reasonable to ask questions during a healthcare consultation.

You might ask what a diagnosis or test result means, what the next step is, whether there are different treatment options, and when you should follow up.

If you are given instructions, repeat them back in your own words if you want to confirm that you understood them correctly.

You can also ask what warning signs should prompt you to seek further medical attention.

Good communication helps patients and healthcare professionals work together more effectively.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 10,
        "max_wait_minutes": 45,
    },
    {
        "slug": "keep-your-health-records-organized",
        "title": "Keep Your Health Records Organized",
        "category": "Health Awareness",
        "summary": "Organized health information can make future healthcare visits smoother.",
        "content": """Keeping important health information organized can save time during future appointments.

Where appropriate, keep records such as prescriptions, laboratory reports, imaging reports, vaccination information, allergies, and previous diagnoses together.

Digital copies can be useful, but protect them with appropriate privacy and security measures.

When visiting a new healthcare facility, bring the information that is relevant to the current consultation.

Always share medical information honestly with healthcare professionals so they can make better-informed decisions.""",
        "reading_time_minutes": 3,
        "min_wait_minutes": 15,
        "max_wait_minutes": 60,
    },
]


async def seed_articles():
    async with SessionLocal() as db:
        result = await db.execute(
            select(Article.article_id).limit(1)
        )

        existing_article = result.scalar_one_or_none()

        if existing_article is not None:
            return

        db.add_all(
            [
                Article(**article_data)
                for article_data in ARTICLES
            ]
        )

        await db.commit()