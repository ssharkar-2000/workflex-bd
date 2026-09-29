import type { JobCategory } from '@prisma/client';
import type { MockGroup } from '@workflex/shared';

/**
 * What the questions look like once stored.
 *
 * `answer` and `why` never leave the server on the way out — see
 * MockTestsService.strip — but they are the reason the row exists: a test
 * whose correct answers lived only in a model's reply could not be marked
 * twice the same way, and a wrong answer nobody can explain teaches nothing.
 */
export type StoredQuestion = {
  prompt: string;
  code: string | null;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
  skill: string;
  why: string;
};

export type Subject = {
  key: string;
  title: string;
  bnTitle: string;
  category: JobCategory;
  group: MockGroup;
  minMinutes: number;
  maxMinutes: number;
  skills: string[];
  /** Questions used when no model is available. */
  bank: StoredQuestion[];
};

/**
 * The subjects on offer, and the questions behind them.
 *
 * The bank is not a degraded version of what the model produces. It is the
 * floor: these are real questions with real explanations, written for this
 * market, and a person who takes a test on a day the model is unavailable
 * gets a test worth taking rather than an apology.
 *
 * Deliberately weighted towards work people in Bangladesh are actually hired
 * for. A mock test suite that is nine parts software engineering serves the
 * fraction of this platform's users who write code and nobody else, so
 * customer service, retail and data entry sit here on equal footing.
 */
export const SUBJECTS: Subject[] = [
  {
    key: 'frontend',
    title: 'Frontend Development',
    bnTitle: 'ফ্রন্টএন্ড ডেভেলপমেন্ট',
    category: 'IT',
    group: 'TECHNICAL',
    minMinutes: 10,
    maxMinutes: 30,
    skills: ['JavaScript basics', 'DOM manipulation', 'CSS layout', 'Debugging'],
    bank: [
      {
        prompt: 'What is the output of the following JavaScript code?',
        code: 'let a = 10;\nlet b = 5;\nconsole.log(a > b ? "A is greater" : "B is greater");',
        options: ['A is greater', 'B is greater', '10', '5'],
        answer: 0,
        skill: 'JavaScript basics',
        why: 'The conditional operator returns the first value when the test is true. 10 > 5 is true, so the first string is printed.',
      },
      {
        prompt: 'Which method adds an element to the end of an array?',
        code: null,
        options: ['push()', 'shift()', 'unshift()', 'pop()'],
        answer: 0,
        skill: 'JavaScript basics',
        why: 'push() appends. pop() removes from the end, shift() removes from the front, unshift() adds to the front.',
      },
      {
        prompt: 'What does this print?',
        code: 'const items = ["a", "b", "c"];\nconsole.log(items.length);',
        options: ['2', '3', '"c"', 'undefined'],
        answer: 1,
        skill: 'JavaScript basics',
        why: 'length is the count of elements, not the last index. Three elements means 3.',
      },
      {
        prompt: 'Which selects an element by its id in the browser?',
        code: null,
        options: [
          'document.getElementById("x")',
          'document.getElementByClass("x")',
          'document.selectId("x")',
          'window.find("x")',
        ],
        answer: 0,
        skill: 'DOM manipulation',
        why: 'getElementById is the method for ids. The others either do not exist or select by something else.',
      },
      {
        prompt: 'How do you change the text inside an element you already have?',
        code: 'const box = document.getElementById("box");',
        options: [
          'box.textContent = "Hello"',
          'box.value("Hello")',
          'box.setText("Hello")',
          'box.innerValue = "Hello"',
        ],
        answer: 0,
        skill: 'DOM manipulation',
        why: 'textContent sets the text of an element. value is for form inputs; the other two are not real.',
      },
      {
        prompt: 'Which CSS property puts space *inside* an element, between its border and its content?',
        code: null,
        options: ['padding', 'margin', 'gap', 'border-spacing'],
        answer: 0,
        skill: 'CSS layout',
        why: 'Padding is inside the border; margin is outside it. Mixing the two up is the most common layout bug there is.',
      },
      {
        prompt: 'In flexbox, which property spreads items along the main axis?',
        code: null,
        options: ['justify-content', 'align-items', 'flex-wrap', 'order'],
        answer: 0,
        skill: 'CSS layout',
        why: 'justify-content works along the main axis; align-items works across it.',
      },
      {
        prompt: 'A page shows nothing and the console says "Cannot read properties of null". What is the usual cause?',
        code: null,
        options: [
          'The script ran before the element existed',
          'The CSS file is missing',
          'The server returned 404',
          'The browser is out of date',
        ],
        answer: 0,
        skill: 'Debugging',
        why: 'Querying the DOM before it is built returns null. Move the script to the end of the body, or wait for the load event.',
      },
      {
        prompt: 'What does this print?',
        code: 'console.log(typeof "5" + 5);',
        options: ['string5', 'number5', '10', '55'],
        answer: 0,
        skill: 'JavaScript basics',
        why: 'typeof "5" is the string "string", and "string" + 5 concatenates to "string5". Precedence catches people out here.',
      },
      {
        prompt: 'Which is the fastest way to find why a button does nothing when clicked?',
        code: null,
        options: [
          'Check the console for errors, then confirm the listener is attached',
          'Rewrite the component',
          'Clear the browser cache',
          'Reinstall the dependencies',
        ],
        answer: 0,
        skill: 'Debugging',
        why: 'Read the error first. Rewriting or reinstalling before you know the cause usually costs an hour and changes nothing.',
      },
    ],
  },
  {
    key: 'customer-service',
    title: 'Customer Service',
    bnTitle: 'কাস্টমার সার্ভিস',
    category: 'RETAIL',
    group: 'NON_TECHNICAL',
    minMinutes: 5,
    maxMinutes: 15,
    skills: ['Handling complaints', 'Communication', 'Product knowledge', 'Escalation'],
    bank: [
      {
        prompt: 'A customer is shouting about a late delivery. What do you do first?',
        code: null,
        options: [
          'Let them finish, then say what you will do about it',
          'Explain immediately that it was not your fault',
          'Transfer the call',
          'Offer a refund straight away',
        ],
        answer: 0,
        skill: 'Handling complaints',
        why: 'Interrupting an angry customer lengthens the call. Letting them finish and then naming a concrete action is what ends it.',
      },
      {
        prompt: 'A customer asks something you do not know the answer to. What is best?',
        code: null,
        options: [
          'Say you will find out, and say when you will come back to them',
          'Guess, so they are not kept waiting',
          'Say it is not your department',
          'Change the subject',
        ],
        answer: 0,
        skill: 'Communication',
        why: 'A guess that turns out wrong costs far more than a short wait. Naming a time is what makes the promise worth anything.',
      },
      {
        prompt: 'When should a complaint go to a supervisor?',
        code: null,
        options: [
          'When the fix needs authority you do not have',
          'Whenever the customer is angry',
          'At the end of every shift',
          'Only if the customer asks',
        ],
        answer: 0,
        skill: 'Escalation',
        why: 'Escalate for authority, not for emotion. Passing on every angry customer teaches them that shouting works and wastes the supervisor.',
      },
      {
        prompt: 'A customer wants a refund the policy does not allow. What is the right first move?',
        code: null,
        options: [
          'Explain what the policy does allow, and offer that',
          'Say no and end the conversation',
          'Give the refund anyway',
          'Tell them to write to head office',
        ],
        answer: 0,
        skill: 'Handling complaints',
        why: 'A flat refusal leaves nowhere to go. Naming what *is* possible keeps the conversation on something you can actually do.',
      },
      {
        prompt: 'Which of these is the most useful thing to record after a difficult call?',
        code: null,
        options: [
          'What was agreed and by when',
          'How rude the customer was',
          'How long the call took',
          'Nothing — it is finished',
        ],
        answer: 0,
        skill: 'Communication',
        why: 'The next person to pick this up needs the promise and the deadline. Everything else is commentary.',
      },
      {
        prompt: 'A customer asks about a product you sell but have not used. What helps most?',
        code: null,
        options: [
          'Knowing where the specification is and reading it with them',
          'Describing it from memory',
          'Recommending a different product',
          'Saying it is popular',
        ],
        answer: 0,
        skill: 'Product knowledge',
        why: 'Knowing where the answer lives beats half-remembering it. Reading it together is also faster than a call-back.',
      },
      {
        prompt: 'What does "first contact resolution" mean?',
        code: null,
        options: [
          'The problem is solved without the customer having to come back',
          'Answering within three rings',
          'The first person who speaks owns the case',
          'Resolving it on the same day',
        ],
        answer: 0,
        skill: 'Product knowledge',
        why: 'It measures whether one contact was enough. It is the single number most call centres are judged on.',
      },
      {
        prompt: 'A customer repeats a question you have already answered. What is happening?',
        code: null,
        options: [
          'Your answer did not land — try saying it differently',
          'They are not listening',
          'They are trying to trick you',
          'The line is bad',
        ],
        answer: 0,
        skill: 'Communication',
        why: 'A repeated question is feedback about the explanation, not about the customer. Repeating the same words louder does not help.',
      },
    ],
  },
  {
    key: 'data-entry',
    title: 'Data Entry',
    bnTitle: 'ডেটা এন্ট্রি',
    category: 'OFFICE',
    group: 'NON_TECHNICAL',
    minMinutes: 5,
    maxMinutes: 10,
    skills: ['Accuracy', 'Spreadsheets', 'Speed', 'Data checking'],
    bank: [
      {
        prompt: 'In a spreadsheet, which adds up the numbers in cells A1 to A10?',
        code: null,
        options: ['=SUM(A1:A10)', '=ADD(A1:A10)', '=TOTAL(A1+A10)', '=COUNT(A1:A10)'],
        answer: 0,
        skill: 'Spreadsheets',
        why: 'SUM adds a range. COUNT counts how many cells have numbers in them, which is a different question.',
      },
      {
        prompt: 'You are given 500 rows to type and a deadline. What should you do first?',
        code: null,
        options: [
          'Check the format of a few rows so you do not repeat a mistake 500 times',
          'Start typing immediately',
          'Ask for more time',
          'Split the file in half',
        ],
        answer: 0,
        skill: 'Accuracy',
        why: 'A misunderstanding found on row 3 costs a minute. Found on row 500, it costs the whole afternoon.',
      },
      {
        prompt: 'Which is the best way to check a long list of entered numbers?',
        code: null,
        options: [
          'Compare a total against the source total',
          'Read every row again',
          'Check the first and last rows',
          'Ask a colleague to look',
        ],
        answer: 0,
        skill: 'Data checking',
        why: 'A matching total catches almost every typing slip in seconds. Re-reading every row is slow and the eye skips.',
      },
      {
        prompt: 'A phone number column shows 1712345678 instead of 01712345678. Why?',
        code: null,
        options: [
          'The column is formatted as a number, so the leading zero was dropped',
          'The data was entered wrongly',
          'The file is corrupted',
          'The column is too narrow',
        ],
        answer: 0,
        skill: 'Spreadsheets',
        why: 'Numbers have no leading zeros. Phone numbers, NIDs and account numbers must be stored as text.',
      },
      {
        prompt: 'What does Ctrl+Z do?',
        code: null,
        options: ['Undoes the last action', 'Saves the file', 'Closes the file', 'Repeats the last action'],
        answer: 0,
        skill: 'Speed',
        why: 'Undo. Knowing it saves retyping and is the most used shortcut in this work.',
      },
      {
        prompt: 'You notice the source document itself has an error. What do you do?',
        code: null,
        options: [
          'Enter what the source says and flag it to whoever owns the data',
          'Correct it silently',
          'Skip the row',
          'Guess the right value',
        ],
        answer: 0,
        skill: 'Accuracy',
        why: 'Silently correcting makes the two copies disagree and nobody knows which is right. Flagging leaves a record.',
      },
      {
        prompt: 'Which is more valuable in data entry work?',
        code: null,
        options: [
          'Fewer mistakes at a steady speed',
          'The fastest typing speed possible',
          'Working without breaks',
          'Never asking questions',
        ],
        answer: 0,
        skill: 'Accuracy',
        why: 'One wrong figure can cost more than an hour of extra speed saves. Accuracy is what this work is paid for.',
      },
      {
        prompt: 'What is the safest way to work on a file you were sent?',
        code: null,
        options: [
          'Keep the original untouched and work on a copy',
          'Edit it directly and save often',
          'Rename it and edit',
          'Email it back after each change',
        ],
        answer: 0,
        skill: 'Data checking',
        why: 'An untouched original is the only thing that lets a mistake be undone after it has been saved over.',
      },
    ],
  },
  {
    key: 'english',
    title: 'Workplace English',
    bnTitle: 'কর্মক্ষেত্রের ইংরেজি',
    category: 'PROFESSIONAL',
    group: 'LANGUAGE',
    minMinutes: 5,
    maxMinutes: 15,
    skills: ['Grammar', 'Workplace writing', 'Comprehension', 'Vocabulary'],
    bank: [
      {
        prompt: 'Choose the correct sentence.',
        code: null,
        options: [
          'I have been working here since 2021.',
          'I am working here since 2021.',
          'I work here since 2021.',
          'I was working here since 2021.',
        ],
        answer: 0,
        skill: 'Grammar',
        why: 'Something that started in the past and continues takes the present perfect continuous with "since".',
      },
      {
        prompt: 'Which is the best opening for an email to a manager you have not met?',
        code: null,
        options: ['Dear Mr Rahman,', 'Hey,', 'Respected sir/madam,', 'Hello there,'],
        answer: 0,
        skill: 'Workplace writing',
        why: 'A name with a title is correct and specific. "Respected sir/madam" is common locally but reads as a form letter.',
      },
      {
        prompt: '"The delivery has been delayed." Who or what is being talked about?',
        code: null,
        options: [
          'The delivery — and who delayed it is not said',
          'The person who delayed it',
          'The customer',
          'Nobody',
        ],
        answer: 0,
        skill: 'Comprehension',
        why: 'The passive puts the delivery first and leaves out who did it — which is often exactly why it is chosen.',
      },
      {
        prompt: 'Choose the correct word: "Please ___ the attached invoice."',
        code: null,
        options: ['find', 'found', 'finding', 'finds'],
        answer: 0,
        skill: 'Grammar',
        why: 'After "please" the verb takes its base form.',
      },
      {
        prompt: 'What does "at your earliest convenience" mean?',
        code: null,
        options: ['As soon as you reasonably can', 'Immediately', 'Whenever you like', 'Within one hour'],
        answer: 0,
        skill: 'Vocabulary',
        why: 'It is a polite way of asking for speed without naming a deadline — which is also why it is often too vague to use.',
      },
      {
        prompt: 'Which sentence is clearest in a work message?',
        code: null,
        options: [
          'I will send the report by 4pm today.',
          'The report will be sent in due course.',
          'Report sending is in progress.',
          'I am going to try to send the report.',
        ],
        answer: 0,
        skill: 'Workplace writing',
        why: 'A named person, a named action, a named time. The others leave the reader guessing about at least one of the three.',
      },
      {
        prompt: 'Choose the correct sentence.',
        code: null,
        options: [
          'There are three people waiting.',
          'There is three people waiting.',
          'There are three person waiting.',
          'There is three persons waiting.',
        ],
        answer: 0,
        skill: 'Grammar',
        why: 'A plural subject takes "are", and the plural of person here is people.',
      },
      {
        prompt: 'A customer writes "I am not satisfied with the service." What are they doing?',
        code: null,
        options: ['Making a complaint', 'Asking a question', 'Cancelling', 'Praising'],
        answer: 0,
        skill: 'Comprehension',
        why: 'It is a complaint stated politely. Reading it as anything softer is how complaints get missed.',
      },
    ],
  },
  {
    key: 'retail-sales',
    title: 'Retail & Sales',
    bnTitle: 'দোকান ও বিক্রয়',
    category: 'RETAIL',
    group: 'NON_TECHNICAL',
    minMinutes: 5,
    maxMinutes: 15,
    skills: ['Selling', 'Cash handling', 'Stock', 'Customer care'],
    bank: [
      {
        prompt: 'A customer is looking at two products and cannot decide. What helps most?',
        code: null,
        options: [
          'Ask what they will use it for',
          'Recommend the more expensive one',
          'Recommend the cheaper one',
          'Leave them to decide',
        ],
        answer: 0,
        skill: 'Selling',
        why: 'The use decides the right product. Recommending on price alone gets it wrong half the time and loses the return visit.',
      },
      {
        prompt: 'The till is short by 200 taka at the end of the day. What do you do?',
        code: null,
        options: [
          'Report it and write down what happened',
          'Make it up from your own pocket',
          'Say nothing and check tomorrow',
          'Adjust the record to match',
        ],
        answer: 0,
        skill: 'Cash handling',
        why: 'A reported shortfall is a mistake. A hidden one, however small, is what a dismissal is built on.',
      },
      {
        prompt: 'When should stock be counted?',
        code: null,
        options: [
          'Regularly, on a schedule everybody knows',
          'Only when something seems missing',
          'Once a year',
          'Whenever the owner asks',
        ],
        answer: 0,
        skill: 'Stock',
        why: 'A regular count finds a problem while it is still small and makes it nobody in particular\'s fault.',
      },
      {
        prompt: 'A customer returns an item after two months with no receipt. What is the right first step?',
        code: null,
        options: [
          'Check the shop\'s policy and explain it',
          'Refuse straight away',
          'Refund from the till',
          'Ask them to come back later',
        ],
        answer: 0,
        skill: 'Customer care',
        why: 'Know the policy, then apply it. Deciding case by case is how two customers get different answers on the same day.',
      },
      {
        prompt: 'Which sells more over a month?',
        code: null,
        options: [
          'Customers who come back',
          'A busy first week',
          'The lowest prices',
          'The largest stock',
        ],
        answer: 0,
        skill: 'Selling',
        why: 'Repeat custom compounds. Everything else on this list is one week.',
      },
      {
        prompt: 'A note looks suspicious. What do you do?',
        code: null,
        options: [
          'Check it properly before accepting, politely',
          'Accept it to avoid an argument',
          'Refuse and accuse the customer',
          'Put it aside and decide later',
        ],
        answer: 0,
        skill: 'Cash handling',
        why: 'Checking is normal and expected. Accepting it costs the shop; accusing somebody costs the shop a customer.',
      },
    ],
  },
];

export const SUBJECT_BY_KEY = new Map(SUBJECTS.map((s) => [s.key, s]));
