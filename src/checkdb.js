async function checkForFound(name, coordinates, id) {
  const checkPersonage = fbFunctions.httpsCallable('checkPersonage');
  let isFound;
  await checkPersonage({
    name,
    coordinates,
    id,
  }).then((response) => {
    isFound = response.data;
  });
  return isFound.data;
}

export { checkForFound };
