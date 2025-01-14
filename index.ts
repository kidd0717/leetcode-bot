import axios from 'axios';
import * as dotenv from 'dotenv';

const LEETCODE_BASE_URL = 'https://leetcode.com/';
const LEETCODE_ALL_QUESTION_URL = `${LEETCODE_BASE_URL}api/problems/all/`;
const LEETCODE_RECOMMENDED_LIST_URL = `${LEETCODE_BASE_URL}list/api/get_list/xo2bgr0r/`;
const LEETCODE_GRAPHQL_URL = `${LEETCODE_BASE_URL}graphql`;

const { SLACK_WEBHOOK_URL } = process.env;
const { DISCORD_WEBHOOK_URL } = process.env;

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Main function
(async () => {
  console.log('func start');
  const { questions } = await getData(LEETCODE_RECOMMENDED_LIST_URL);
  const ids = generateListIds(questions);
  const allData = await getData(LEETCODE_ALL_QUESTION_URL);
  console.log(allData);
  // pick medium
  await pick(allData, ids, 2);
  await pick(allData, ids, 3);
})();

async function pick(allData, ids, difficulty_number) {
  console.log(difficulty_number);

  const mediumData = getFreeQuestions(allData, difficulty_number);
  const data2 = getListQuestions(allData, ids);
  const allQuestions = [...mediumData, ...data2];
  var pickedMediumQuestion = popQuestion(allQuestions);
  const titleSlug = pickedMediumQuestion['stat']['question__title_slug'];
  const { data } = await getQuestionInfo(titleSlug);
  var likes = data['question']['likes'];
  var dislikes = data['question']['dislikes'];

  while (likes < dislikes) {
    pickedMediumQuestion = popQuestion([...mediumData, ...data2]);
    const titleSlug = pickedMediumQuestion['stat']['question__title_slug'];
    const { data } = await getQuestionInfo(titleSlug);
    likes = data['question']['likes'];
    dislikes = data['question']['dislikes'];
  }

  const { difficulty: d, stat } = pickedMediumQuestion;
  const text = formatText(
    stat.frontend_question_id,
    stat.question__title,
    stat.question__title_slug,
    DIFFICULTIES[d.level - 1],
  );

  postQuestion(text);
}

// API call
async function getData(url) {
  const { data } = await axios({
    method: 'get',
    url,
  });
  return data;
}

// Get all non-paid questions
function getFreeQuestions(data, difficulty_number) {
  return data.stat_status_pairs.filter(
    ({ difficulty, paid_only }) =>
      difficulty.level === difficulty_number && !paid_only,
  );
}

// Get 60 recommended question IDs
function generateListIds(data) {
  const ids = new Set();
  data.forEach(({ id }) => {
    ids.add(id);
  });
  return ids;
}

// Get 60 recommended questions
function getListQuestions(data, ids) {
  return data.stat_status_pairs.filter(({ stat }) =>
    ids.has(stat.frontend_question_id),
  );
}

async function getQuestionInfo(name) {
  const query =
    'query questionData($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    questionId\n    questionFrontendId\n    boundTopicId\n    title\n    titleSlug\n    content\n    translatedTitle\n    translatedContent\n    isPaidOnly\n    difficulty\n    likes\n    dislikes\n    isLiked\n    similarQuestions\n    contributors {\n      username\n      profileUrl\n      avatarUrl\n      __typename\n    }\n    langToValidPlayground\n    topicTags {\n      name\n      slug\n      translatedName\n      __typename\n    }\n    companyTagStats\n    codeSnippets {\n      lang\n      langSlug\n      code\n      __typename\n    }\n    stats\n    hints\n    solution {\n      id\n      canSeeDetail\n      __typename\n    }\n    status\n    sampleTestCase\n    metaData\n    judgerAvailable\n    judgeType\n    mysqlSchemas\n    enableRunCode\n    enableTestMode\n    envInfo\n    libraryUrl\n    __typename\n  }\n}\n';
  const { data } = await axios({
    method: 'post',
    url: LEETCODE_GRAPHQL_URL,
    data: {
      operationName: 'questionData',
      variables: {
        titleSlug: name,
      },
      query: query,
    },
  });
  return data;
}

// Pick a qestion to post
function popQuestion(data) {
  const i = Math.floor(Math.random() * data.length);
  return data.splice(i, 1)[0];
}

// Format message
function formatText(
  num: number,
  title: string,
  dir: string,
  difficulty: string,
): string {
  const link = `${LEETCODE_BASE_URL}problems/${dir}/`;
  return `${num}. ${title} - ${difficulty}\n${link}`;
}

// Post the generated message to Slack
async function postQuestion(text: string) {
  console.log(DISCORD_WEBHOOK_URL);

  await axios({
    method: 'post',
    url: SLACK_WEBHOOK_URL,
    data: { text },
  });

  await axios({
    method: 'post',
    url: DISCORD_WEBHOOK_URL,
    data: { username: 'Leetcode Bot', content: text },
  });
}
