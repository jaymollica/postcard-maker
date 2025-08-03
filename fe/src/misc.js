export function isObjectEmpty(obj){
	for (var i in obj) return false;
	return true;
}